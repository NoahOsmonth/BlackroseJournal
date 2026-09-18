/**
 * R2 pricing — supersession + fading, measured on the fixed R0 ledger.
 *
 * Three things are measured, none asserted by construction:
 *
 *   1. **Recall metrics before/after Dream** — the same numbers R0/R1 report,
 *      so R2's state is directly comparable to the baseline.
 *   2. **Supersession** — how many restated memories a pass collapses. On this
 *      ledger the honest answer is zero (its distractors are distinct entries
 *      with templated headers), which is why supersession's own value is priced
 *      by its unit scenario rather than claimed here.
 *   3. **Fading, as a same-store A/B** — for every probe that resolves to a
 *      thread, the pre-R2 selection rule and the faded rule are both run over
 *      the *same* manifest, so the delta cannot be explained by run-to-run
 *      jitter in what got promoted.
 *
 * Offline and deterministic. `llm: true` only changes Dream's planner.
 *
 *   npx jest --runInBand __tests__/probes/r2RecallDelta.test.ts --forceExit
 */

import { setCustomModelStorageAdapter, resetCustomModelStorageAdapter } from '../services/ai/customModels';
import { setDayDigestStorageAdapter, resetDayDigestStorageAdapter } from '../services/memory/dayDigestStorage';
import { setIdentityStorageAdapter, resetIdentityStorageAdapter } from '../services/memory/identityProfile';
import { runMemoryDream, type DreamOutcome } from '../services/memory/memoryDream';
import { rankMemoryFiles } from '../services/memory/memoryFade';
import {
    clearMemoryFiles,
    listFormalProjectIds,
    listMemoryFiles,
    resetMemoryFilesStorageAdapter,
    setMemoryFilesStorageAdapter,
} from '../services/memory/memoryFiles';
import type { MemoryFileHeader } from '../services/memory/memoryFiles';
import { clearMemoryRecallCache, RECALL_TOP_K, retrieveMemory } from '../services/memory/memoryRetrieval';
import {
    supersedeRestatedMemories,
    type SupersedeOutcome,
} from '../services/memory/memorySupersession';
import { writeArtifact, writeJsonArtifact } from './shared/artifacts';
import {
    RECALL_PROBES,
    resolveLedgerIdsByName,
    seedRecallLedger,
    type SeededRecallLedger,
} from './shared/recallLedger';
import {
    computeRecallMetrics,
    measureRecallProbes,
    type R0Metrics,
    type R0ProbeRow,
} from './r0_recallMetrics';

export interface R2Phase {
    metrics: R0Metrics;
    rows: R0ProbeRow[];
    formalThreadIds: readonly string[];
}

export interface R2SelectionRow {
    probeId: string;
    threadId: string | null;
    expectedIds: readonly string[];
    legacySelected: readonly string[];
    fadedSelected: readonly string[];
    legacyHit: boolean | null;
    fadedHit: boolean | null;
    /** 0-based rank of the first expected file under each rule; null if absent. */
    legacyRank: number | null;
    fadedRank: number | null;
}

export interface R2RecallDelta {
    phase: 'R2';
    measuredAt: string;
    seededFiles: number;
    dream: DreamOutcome | null;
    supersession: SupersedeOutcome;
    before: R2Phase;
    after: R2Phase;
    /** Same store, measured twice: false would mean the selection is not stable. */
    afterReproducible: boolean;
    selection: R2SelectionRow[];
    notes: string[];
}

function memoryAdapter() {
    const store = new Map<string, string>();
    return {
        getItem: async (key: string) => store.get(key) ?? null,
        setItem: async (key: string, value: string) => {
            store.set(key, value);
        },
        removeItem: async (key: string) => {
            store.delete(key);
        },
    };
}

/** The exact pre-R2 selection rule, kept as the oracle fading must beat. */
function legacyTokenize(query: string): string[] {
    return query
        .toLowerCase()
        .split(/[\s/_-]+/)
        .map((token) => token.replace(/[^a-z0-9']/g, ''))
        .filter((token) => token.length >= 3);
}

function legacySelection(manifest: readonly MemoryFileHeader[], query: string): string[] {
    const tokens = legacyTokenize(query);
    return manifest
        .map((header) => {
            const hay = (header.name + ' ' + header.description).toLowerCase();
            const score = tokens.reduce((total, token) => total + (hay.includes(token) ? 1 : 0), 0);
            return { header, score };
        })
        .sort((a, b) => b.score - a.score || b.header.updatedAt.localeCompare(a.header.updatedAt))
        .slice(0, RECALL_TOP_K)
        .map((row) => row.header.id);
}

function firstExpectedRank(selected: readonly string[], expected: readonly string[]): number | null {
    const rank = selected.findIndex((id) => expected.includes(id));
    return rank === -1 ? null : rank;
}

async function compareSelection(ledger: SeededRecallLedger): Promise<R2SelectionRow[]> {
    const rows: R2SelectionRow[] = [];
    for (const probe of RECALL_PROBES) {
        clearMemoryRecallCache();
        const retrieval = await retrieveMemory(probe.question, { mode: 'explicit' });
        const threadId = retrieval.debug.resolvedProjectId ?? null;
        const expected = new Set<string>();
        const expectedThread = probe.expectProjectId?.replace(/_/g, '-');
        const pool = expectedThread
            ? ledger.files.filter((file) => file.projectId.replace(/_/g, '-') === expectedThread)
            : ledger.files;
        for (const role of probe.expectedRoles) {
            if (role === 'user') {
                ledger.userIds.forEach((id) => expected.add(id));
                continue;
            }
            pool.filter((file) => file.role === role && file.id).forEach((file) => expected.add(file.id!));
        }
        const expectedIds = [...expected];

        if (!threadId) {
            rows.push({
                probeId: probe.id,
                threadId: null,
                expectedIds,
                legacySelected: [],
                fadedSelected: retrieval.debug.selectedFileIds,
                legacyHit: null,
                fadedHit: null,
                legacyRank: null,
                fadedRank: null,
            });
            continue;
        }

        const manifest = await listMemoryFiles({ projectId: threadId, limit: 200 });
        const legacySelected = legacySelection(manifest, probe.question);
        const fadedSelected = rankMemoryFiles(manifest, probe.question)
            .slice(0, RECALL_TOP_K)
            .map((row) => row.header.id);

        rows.push({
            probeId: probe.id,
            threadId,
            expectedIds,
            legacySelected,
            fadedSelected,
            legacyHit: expectedIds.length ? legacySelected.some((id) => expectedIds.includes(id)) : null,
            fadedHit: expectedIds.length ? fadedSelected.some((id) => expectedIds.includes(id)) : null,
            legacyRank: firstExpectedRank(legacySelected, expectedIds),
            fadedRank: firstExpectedRank(fadedSelected, expectedIds),
        });
    }
    return rows;
}

function sameSelections(a: readonly R0ProbeRow[], b: readonly R0ProbeRow[]): boolean {
    return a.length === b.length
        && a.every((row, index) => {
            const other = b[index];
            return other !== undefined && row.probeId === other.probeId
                && row.selectedFileIds.join('|') === other.selectedFileIds.join('|');
        });
}

async function phase(ledger: SeededRecallLedger): Promise<R2Phase> {
    const anchored = await resolveLedgerIdsByName(ledger);
    const rows = await measureRecallProbes(anchored, { live: false });
    return {
        rows,
        metrics: computeRecallMetrics(rows),
        formalThreadIds: await listFormalProjectIds(),
    };
}

export async function runR2RecallDelta(
    options: { llm?: boolean; writeArtifacts?: boolean } = {},
): Promise<R2RecallDelta> {
    setMemoryFilesStorageAdapter(memoryAdapter());
    setCustomModelStorageAdapter(memoryAdapter());
    setDayDigestStorageAdapter(memoryAdapter());
    setIdentityStorageAdapter(memoryAdapter());

    let ledger: SeededRecallLedger;
    let before!: R2Phase;
    let after!: R2Phase;
    let afterAgain!: R2Phase;
    let dream: DreamOutcome | null = null;
    let supersession: SupersedeOutcome = { superseded: 0, threads: [], truncated: [] };
    let selection: R2SelectionRow[] = [];
    try {
        await clearMemoryFiles();
        ledger = await seedRecallLedger({ staged: true });
        before = await phase(ledger);
        dream = await runMemoryDream({ tryLlm: options.llm ?? false }).catch((error: unknown) => {
            console.warn('R2 delta: Dream failed:', error);
            return null;
        });
        after = await phase(ledger);
        afterAgain = await phase(ledger);
        const anchored = await resolveLedgerIdsByName(ledger);
        supersession = await supersedeRestatedMemories();
        selection = await compareSelection(anchored);
    } finally {
        resetIdentityStorageAdapter();
        resetDayDigestStorageAdapter();
        resetCustomModelStorageAdapter();
        resetMemoryFilesStorageAdapter();
    }

    const result: R2RecallDelta = {
        phase: 'R2',
        measuredAt: new Date().toISOString(),
        seededFiles: ledger.files.length,
        dream,
        supersession,
        before,
        after,
        afterReproducible: sameSelections(after.rows, afterAgain.rows),
        selection,
        notes: [
            'Fading is priced as a same-store A/B: both rules run over one promoted manifest, so promotion jitter cannot explain the delta.',
            'Supersession reports zero on this ledger by design — its distractors are distinct entries whose headers are templated, which is exactly the case supersession must refuse.',
            'No floors asserted: this measures the R2 delta, it does not gate it.',
            'Dream promotes at most MAX_DREAM_FILES (20) per run, so threads still in _tmp cannot resolve and fall back to recency.',
        ],
    };

    if (options.writeArtifacts ?? false) {
        writeJsonArtifact('r2-recall-delta.json', result);
        writeArtifact('r2-recall-delta.md', formatR2DeltaMarkdown(result));
    }
    return result;
}

export function formatR2DeltaMarkdown(result: R2RecallDelta): string {
    const pct = (value: number | null): string => (value === null ? 'n/a' : (value * 100).toFixed(1) + '%');
    const metricRows = [
        ['hit-rate', result.before.metrics.hitRate.rate, result.after.metrics.hitRate.rate],
        ['precision', result.before.metrics.precision.mean, result.after.metrics.precision.mean],
        ['route accuracy', result.before.metrics.routeAccuracy.rate, result.after.metrics.routeAccuracy.rate],
    ] as const;
    return [
        '# R2 — supersession + fading (same R0 ledger)',
        '',
        '- measured: ' + result.measuredAt,
        '- Dream: ' + (result.dream?.summary ?? '(failed — soft-fail)'),
        '- supersession: ' + result.supersession.superseded + ' restated file(s) in ' + result.supersession.threads.length + ' thread(s)',
        '- same-store rerun identical: ' + result.afterReproducible,
        '',
        '| metric | before Dream | after Dream (R2 selection) |',
        '|---|---|---|',
        ...metricRows.map((row) => '| ' + row[0] + ' | ' + pct(row[1]) + ' | ' + pct(row[2]) + ' |'),
        '',
        '## Fading A/B (one manifest, two rules)',
        '',
        '| probe | thread | expected | legacy selected | legacy hit | faded selected | faded hit | legacy rank | faded rank |',
        '|---|---|---|---|---|---|---|---|---|',
        ...result.selection.map((row) => '| ' + [
            row.probeId,
            row.threadId ?? '(recency fallback)',
            row.expectedIds.length,
            row.legacySelected.length,
            row.legacyHit === null ? '—' : String(row.legacyHit),
            row.fadedSelected.length,
            row.fadedHit === null ? '—' : String(row.fadedHit),
            row.legacyRank === null ? '—' : String(row.legacyRank),
            row.fadedRank === null ? '—' : String(row.fadedRank),
        ].join(' | ') + ' |'),
        '',
        '## Notes',
        '',
        ...result.notes.map((note) => '- ' + note),
        '',
    ].join('\n');
}
