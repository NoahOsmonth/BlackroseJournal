/**
 * R2 pricing — what supersession is actually worth.
 *
 * `r2_recallDelta` prices fading and reports supersession as zero, because the
 * R0 ledger is built out of distinct entries. That leaves supersession *proven
 * safe* but *unpriced*. This probe prices it on the separate restatement
 * scenario (`probes/shared/restatementScenario.ts`), where a real restatement
 * pair exists and a control pair sits next to it.
 *
 * The measurement is a same-store A/B, for the same reason fading's was:
 *
 *   before = seeded into formal threads with no Dream pass (post-promotion,
 *            pre-supersession)
 *   after  = the same store with exactly one supersession pass applied
 *
 * So nothing but the pass can explain the difference. Three things are priced:
 *
 *   1. **The stale copy leaves recall.** It was selected before and is not after.
 *   2. **The survivor keeps answering.** The expected file is still selected and
 *      still in the recalled context.
 *   3. **The recall budget it frees.** Both copies were being injected; after the
 *      pass the thread costs one copy instead of two.
 *
 * And one thing is guarded: the control thread keeps both of its distinct
 * memories. A supersession pass that also collapsed the control would score
 * better on (1) and (3) while silently deleting real memories.
 *
 * Offline and deterministic.
 *
 *   npx jest --runInBand __tests__/probes/r2SupersessionDelta.test.ts --forceExit
 */

import { setCustomModelStorageAdapter, resetCustomModelStorageAdapter } from '../services/ai/customModels';
import { setDayDigestStorageAdapter, resetDayDigestStorageAdapter } from '../services/memory/dayDigestStorage';
import { setIdentityStorageAdapter, resetIdentityStorageAdapter } from '../services/memory/identityProfile';
import {
    clearMemoryFiles,
    listMemoryFiles,
    resetMemoryFilesStorageAdapter,
    setMemoryFilesStorageAdapter,
} from '../services/memory/memoryFiles';
import { clearMemoryRecallCache, retrieveMemory } from '../services/memory/memoryRetrieval';
import {
    supersedeRestatedMemories,
    type SupersedeOutcome,
} from '../services/memory/memorySupersession';
import { writeArtifact, writeJsonArtifact } from './shared/artifacts';
import {
    CONTROL_THREAD_ID,
    RESTATEMENT_PROBES,
    RESTATEMENT_THREAD_ID,
    seedRestatementScenario,
    type SeededRestatementScenario,
} from './shared/restatementScenario';

export interface SupersessionProbeRow {
    probeId: string;
    intent: string;
    question: string;
    projectId: string;
    resolvedProjectId: string | null;
    expectedId: string;
    staleId: string | null;
    selectedFileIds: readonly string[];
    /** Did recall surface the file that should survive? */
    hit: boolean;
    /** Did recall still surface the copy that should be gone? */
    staleSelected: boolean;
    /** Share of selected files that were the expected one. */
    precision: number | null;
    contextChars: number;
}

export interface SupersessionPhase {
    rows: SupersessionProbeRow[];
    hitRate: number | null;
    meanPrecision: number | null;
    /** Files injected into context that a correct store would not have injected. */
    staleSelectedCount: number;
    contextChars: number;
    liveFileCount: number;
}

export interface SupersessionAudit {
    id: string;
    deprecated: boolean;
    supersededBy: string | null;
    supersededAt: string | null;
    reason: string | null;
}

export interface R2SupersessionDelta {
    phase: 'R2';
    measuredAt: string;
    seededFiles: number;
    supersession: SupersedeOutcome;
    before: SupersessionPhase;
    after: SupersessionPhase;
    audit: SupersessionAudit | null;
    /** Both control memories still live and still selectable after the pass. */
    controlIntact: boolean;
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

async function measure(
    ledger: SeededRestatementScenario,
    liveCount: () => Promise<number>,
): Promise<SupersessionPhase> {
    const rows: SupersessionProbeRow[] = [];
    for (const probe of RESTATEMENT_PROBES) {
        clearMemoryRecallCache();
        const retrieval = await retrieveMemory(probe.question, { mode: 'explicit' });
        const selected = retrieval.debug.selectedFileIds;
        const expectedId = ledger.idsByRole[probe.expectRole] as string;
        const staleId = probe.staleRole ? (ledger.idsByRole[probe.staleRole] as string) : null;
        const selectedExpected = selected.filter((id) => id === expectedId).length;
        rows.push({
            probeId: probe.id,
            intent: probe.intent,
            question: probe.question,
            projectId: probe.projectId,
            resolvedProjectId: retrieval.debug.resolvedProjectId ?? null,
            expectedId,
            staleId,
            selectedFileIds: selected,
            hit: selectedExpected > 0,
            staleSelected: staleId !== null && selected.includes(staleId),
            precision: selected.length === 0 ? null : selectedExpected / selected.length,
            contextChars: retrieval.context.length,
        });
    }
    const hits = rows.filter((row) => row.hit).length;
    const precisions = rows.map((row) => row.precision).filter((p): p is number => p !== null);
    return {
        rows,
        hitRate: rows.length === 0 ? null : hits / rows.length,
        meanPrecision: precisions.length === 0
            ? null
            : precisions.reduce((sum, p) => sum + p, 0) / precisions.length,
        staleSelectedCount: rows.filter((row) => row.staleSelected).length,
        contextChars: rows.reduce((sum, row) => sum + row.contextChars, 0),
        liveFileCount: await liveCount(),
    };
}

async function countLiveFiles(projectId: string): Promise<number> {
    return (await listMemoryFiles({ projectId, limit: 100 })).length;
}

async function readAudit(staleId: string): Promise<SupersessionAudit | null> {
    const all = await listMemoryFiles({ includeDeprecated: true, limit: 200 });
    const header = all.find((h) => h.id === staleId);
    if (!header) return null;
    return {
        id: header.id,
        deprecated: Boolean(header.deprecated),
        supersededBy: header.supersededBy ?? null,
        supersededAt: header.supersededAt ?? null,
        reason: header.supersedeReason ?? null,
    };
}

export async function runR2SupersessionDelta(
    options: { writeArtifacts?: boolean } = {},
): Promise<R2SupersessionDelta> {
    setMemoryFilesStorageAdapter(memoryAdapter());
    setCustomModelStorageAdapter(memoryAdapter());
    setDayDigestStorageAdapter(memoryAdapter());
    setIdentityStorageAdapter(memoryAdapter());

    let ledger!: SeededRestatementScenario;
    let before!: SupersessionPhase;
    let after!: SupersessionPhase;
    let supersession: SupersedeOutcome = { superseded: 0, threads: [], truncated: [] };
    let audit: SupersessionAudit | null = null;
    let controlIntact = false;
    try {
        await clearMemoryFiles();
        ledger = await seedRestatementScenario();
        before = await measure(ledger, async () => (
            await countLiveFiles(RESTATEMENT_THREAD_ID) + await countLiveFiles(CONTROL_THREAD_ID)
        ));
        supersession = await supersedeRestatedMemories();
        after = await measure(ledger, async () => (
            await countLiveFiles(RESTATEMENT_THREAD_ID) + await countLiveFiles(CONTROL_THREAD_ID)
        ));
        audit = await readAudit(ledger.idsByRole.stale as string);

        const controlOld = ledger.idsByRole['control-old'] as string;
        const controlNew = ledger.idsByRole['control-new'] as string;
        const controlLive = await countLiveFiles(CONTROL_THREAD_ID);
        const controlProbe = after.rows.find((row) => row.probeId === 'control-topic');
        controlIntact = controlLive === 2
            && Boolean(controlProbe?.selectedFileIds.includes(controlOld))
            && Boolean(controlProbe?.selectedFileIds.includes(controlNew));
    } finally {
        resetIdentityStorageAdapter();
        resetDayDigestStorageAdapter();
        resetCustomModelStorageAdapter();
        resetMemoryFilesStorageAdapter();
    }

    const result: R2SupersessionDelta = {
        phase: 'R2',
        measuredAt: new Date().toISOString(),
        seededFiles: ledger.files.length,
        supersession,
        before,
        after,
        audit,
        controlIntact,
        notes: [
            'Same-store A/B: the before phase is the seeded store with no Dream pass, the after phase is the same store after exactly one supersession pass.',
            'The stale copy is a superset-contained restatement, not a near-topic neighbour — the R0 ledger already proves supersession refuses those.',
            'The control thread shares vocabulary and sentence shape with the restatement pair, so it would collapse under a similarity criterion.',
            'The superseded file is deprecated, not deleted: its bytes stay readable through includeDeprecated for audit.',
        ],
    };

    if (options.writeArtifacts ?? false) {
        writeJsonArtifact('r2-supersession-delta.json', result);
        writeArtifact('r2-supersession-delta.md', formatSupersessionMarkdown(result));
    }
    return result;
}

export function formatSupersessionMarkdown(result: R2SupersessionDelta): string {
    const num = (value: number | null, digits = 3): string => (
        value === null ? 'n/a' : value.toFixed(digits)
    );
    const probeRows = result.before.rows.map((row) => {
        const after = result.after.rows.find((r) => r.probeId === row.probeId);
        return '| ' + row.probeId
            + ' | ' + String(row.staleSelected) + ' -> ' + String(after?.staleSelected ?? false)
            + ' | ' + String(row.hit) + ' -> ' + String(after?.hit ?? false)
            + ' | ' + num(row.precision) + ' -> ' + num(after?.precision ?? null)
            + ' | ' + String(row.contextChars) + ' -> ' + String(after?.contextChars ?? 0)
            + ' |';
    });
    return [
        '# R2 — supersession pricing (restatement scenario)',
        '',
        'Same store, one supersession pass between the two measurements.',
        '',
        '| metric | before | after |',
        '|---|---|---|',
        '| hit-rate | ' + num(result.before.hitRate) + ' | ' + num(result.after.hitRate) + ' |',
        '| mean precision | ' + num(result.before.meanPrecision) + ' | ' + num(result.after.meanPrecision) + ' |',
        '| stale copies selected | ' + String(result.before.staleSelectedCount) + ' | ' + String(result.after.staleSelectedCount) + ' |',
        '| recalled context chars | ' + String(result.before.contextChars) + ' | ' + String(result.after.contextChars) + ' |',
        '| live files in priced threads | ' + String(result.before.liveFileCount) + ' | ' + String(result.after.liveFileCount) + ' |',
        '| control thread intact | — | ' + String(result.controlIntact) + ' |',
        '',
        '| probe | stale selected | hit | precision | context chars |',
        '|---|---|---|---|---|',
        ...probeRows,
        '',
        '## Audit pointer written',
        '',
        result.audit
            ? '- `' + result.audit.id + '`\n'
                + '- deprecated: ' + String(result.audit.deprecated) + '\n'
                + '- supersededBy: `' + String(result.audit.supersededBy) + '`\n'
                + '- supersededAt: ' + String(result.audit.supersededAt) + '\n'
                + '- reason: ' + String(result.audit.reason)
            : '- none',
        '',
        '## Notes',
        '',
        ...result.notes.map((note) => '- ' + note),
        '',
    ].join('\n');
}
