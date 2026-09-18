/**
 * R1 pricing — measure the same R0 probes before and after Dream promotion.
 *
 * Seeds the ledger the way a real device does (`_tmp` staging with thread
 * hints), measures recall, runs `runMemoryDream`, measures again. The delta is
 * what R1 buys: consolidation moves staged files into formal threads, which is
 * the only path that gives `retrieveMemory` a thread shortlist instead of its
 * recency fallback.
 *
 * Deterministic by default (offline Dream plan, no LLM). `llm: true` prices the
 * LLM-plan path, which is what the running trigger uses.
 *
 *   npx jest --runInBand __tests__/probes/dreamDelta.test.ts --forceExit
 */

import { setCustomModelStorageAdapter, resetCustomModelStorageAdapter } from '../services/ai/customModels';
import { setDayDigestStorageAdapter, resetDayDigestStorageAdapter } from '../services/memory/dayDigestStorage';
import { setIdentityStorageAdapter, resetIdentityStorageAdapter } from '../services/memory/identityProfile';
import {
    clearMemoryFiles,
    listFormalProjectIds,
    resetMemoryFilesStorageAdapter,
    setMemoryFilesStorageAdapter,
} from '../services/memory/memoryFiles';
import { runMemoryDream, type DreamOutcome } from '../services/memory/memoryDream';
import { writeArtifact, writeJsonArtifact } from './shared/artifacts';
import {
    computeRecallMetrics,
    measureRecallProbes,
    type R0Metrics,
    type R0ProbeRow,
} from './r0_recallMetrics';
import {
    resolveLedgerIdsByName,
    seedRecallLedger,
    type SeededRecallLedger,
} from './shared/recallLedger';

export interface R0DreamPhase {
    metrics: R0Metrics;
    rows: R0ProbeRow[];
    formalThreadIds: readonly string[];
}

export interface R0DreamDelta {
    phase: 'R1';
    measuredAt: string;
    llmPlan: boolean;
    seedMs: number;
    stagedFiles: number;
    dream: DreamOutcome | null;
    before: R0DreamPhase;
    after: R0DreamPhase;
    delta: {
        hitRate: number | null;
        precision: number | null;
        promptBytesMedian: number;
        retrievalMedianMs: number;
    };
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

async function phase(ledger: SeededRecallLedger): Promise<R0DreamPhase> {
    // Promotion renames ids; expectations follow the memory, not its first id.
    const anchored = await resolveLedgerIdsByName(ledger);
    const rows = await measureRecallProbes(anchored, { live: false });
    return {
        rows,
        metrics: computeRecallMetrics(rows),
        formalThreadIds: await listFormalProjectIds(),
    };
}

export async function runR0DreamDelta(
    options: { llm?: boolean; writeArtifacts?: boolean } = {},
): Promise<R0DreamDelta> {
    const llmPlan = options.llm ?? false;
    setMemoryFilesStorageAdapter(memoryAdapter());
    setCustomModelStorageAdapter(memoryAdapter());
    setDayDigestStorageAdapter(memoryAdapter());
    setIdentityStorageAdapter(memoryAdapter());

    let ledger: SeededRecallLedger;
    let before!: R0DreamPhase;
    let after!: R0DreamPhase;
    let dream: DreamOutcome | null = null;
    try {
        await clearMemoryFiles();
        ledger = await seedRecallLedger({ staged: true });
        before = await phase(ledger);
        dream = await runMemoryDream({ tryLlm: llmPlan }).catch((error: unknown) => {
            console.warn('Dream delta: Dream failed:', error);
            return null;
        });
        after = await phase(ledger);
    } finally {
        resetIdentityStorageAdapter();
        resetDayDigestStorageAdapter();
        resetCustomModelStorageAdapter();
        resetMemoryFilesStorageAdapter();
    }

    const rate = (value: number | null): number | null => value;
    const hitDelta = before.metrics.hitRate.rate === null || after.metrics.hitRate.rate === null
        ? null
        : after.metrics.hitRate.rate - before.metrics.hitRate.rate;
    const precisionDelta = before.metrics.precision.mean === null || after.metrics.precision.mean === null
        ? null
        : after.metrics.precision.mean - before.metrics.precision.mean;

    const result: R0DreamDelta = {
        phase: 'R1',
        measuredAt: new Date().toISOString(),
        llmPlan,
        seedMs: ledger.seedMs,
        stagedFiles: ledger.files.length,
        dream,
        before,
        after,
        delta: {
            hitRate: hitDelta,
            precision: precisionDelta,
            promptBytesMedian: after.metrics.promptBytes.median - before.metrics.promptBytes.median,
            retrievalMedianMs: after.metrics.retrievalLatencyMs.medianMs - before.metrics.retrievalLatencyMs.medianMs,
        },
        notes: [
            llmPlan
                ? 'Dream ran with the LLM plan (what the idle trigger uses in the app).'
                : 'Dream ran with the deterministic offline plan (CI-safe pricing of promotion alone).',
            'Before-phase has no formal threads by construction, so recall leans on the recency fallback.',
            'No floors asserted: this measures the R1 delta, it does not gate it.',
            'After R2 the after-phase uses the faded selection (services/memory/memoryFade), so these numbers are the R1+R2 state; R2 prices its own delta in probes/r2_recallDelta.ts.',
            `route-accuracy before ${rate(before.metrics.routeAccuracy.rate)?.toFixed(3)} / after ${rate(after.metrics.routeAccuracy.rate)?.toFixed(3)}`,
        ],
    };

    if (options.writeArtifacts ?? false) {
        writeJsonArtifact('r0-dream-delta.json', result);
        writeArtifact('r0-dream-delta.md', formatDreamDeltaMarkdown(result));
    }
    return result;
}

export function formatDreamDeltaMarkdown(result: R0DreamDelta): string {
    const pct = (value: number | null): string => (value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`);
    const rows = result.before.rows.map((beforeRow, index) => {
        const afterRow = result.after.rows[index];
        return `| ${beforeRow.probeId} | ${beforeRow.hit === null ? '—' : beforeRow.hit} | ${afterRow?.hit === null || afterRow === undefined ? '—' : afterRow.hit} | ${beforeRow.selectedFileIds.length} | ${afterRow?.selectedFileIds.length ?? 0} | ${beforeRow.promptBytes} | ${afterRow?.promptBytes ?? 0} |`;
    });
    return [
        '# R1 — Dream promotion delta (same probes, before vs after)',
        '',
        `- measured: ${result.measuredAt}`,
        `- Dream plan: ${result.llmPlan ? 'LLM' : 'offline deterministic'}`,
        `- staged ledger: ${result.stagedFiles} files (seed ${result.seedMs}ms)`,
        `- Dream outcome: ${result.dream?.summary ?? '(failed — soft-fail)'}`,
        '',
        '| metric | before | after | delta |',
        '|---|---|---|---|',
        `| hit-rate | ${pct(result.before.metrics.hitRate.rate)} | ${pct(result.after.metrics.hitRate.rate)} | ${pct(result.delta.hitRate)} |`,
        `| precision | ${result.before.metrics.precision.mean?.toFixed(3) ?? 'n/a'} | ${result.after.metrics.precision.mean?.toFixed(3) ?? 'n/a'} | ${result.delta.precision?.toFixed(3) ?? 'n/a'} |`,
        `| prompt bytes (median) | ${result.before.metrics.promptBytes.median} | ${result.after.metrics.promptBytes.median} | ${result.delta.promptBytesMedian} |`,
        `| retrieval ms (median) | ${result.before.metrics.retrievalLatencyMs.medianMs} | ${result.after.metrics.retrievalLatencyMs.medianMs} | ${result.delta.retrievalMedianMs} |`,
        `| formal threads | ${result.before.formalThreadIds.length} | ${result.after.formalThreadIds.length} | ${result.after.formalThreadIds.length - result.before.formalThreadIds.length} |`,
        '',
        '| probe | hit before | hit after | selected before | selected after | bytes before | bytes after |',
        '|---|---|---|---|---|---|---|',
        ...rows,
        '',
        '## Notes',
        '',
        ...result.notes.map((note) => `- ${note}`),
        '',
    ].join('\n');
}
