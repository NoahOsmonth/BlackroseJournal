/**
 * R0 — recall measurement harness (baseline, no behaviour change).
 *
 * Seeds a deterministic fixture ledger into the REAL offline memory store
 * (`memoryFiles`), runs the fixed probe set through the REAL recall path
 * (`retrieveMemory` / the `memory_search` tool), and reports six metrics:
 *
 *   1. hit-rate        — probes whose expected memory surfaced in the selection
 *   2. precision       — share of selected files that were the expected ones
 *   3. grounding       — live replies that quote the planted token verbatim
 *   4. prompt bytes    — utf8 size of the memory-search output entering the turn
 *   5. retrieval latency — wall ms of `retrieveMemory`
 *   6. whole-turn latency — wall ms of a tool-enabled agent turn
 *
 * Hindsight and Supabase are never called by this harness; the recall path
 * under test is offline-only. Targets are deliberately NOT asserted here — R0
 * establishes the numbers that later phases are priced against.
 *
 *   PROBE_LLM=1 npx jest --runInBand __tests__/probes/recallMetrics.test.ts --forceExit
 */

import { runAgentTurnWithTools } from '../services/ai/agentLoop';
import { setCustomModelStorageAdapter, resetCustomModelStorageAdapter } from '../services/ai/customModels';
import { memorySearchTool } from '../services/ai/tools/memoryFileTools';
import { setDayDigestStorageAdapter, resetDayDigestStorageAdapter } from '../services/memory/dayDigestStorage';
import { setIdentityStorageAdapter, resetIdentityStorageAdapter } from '../services/memory/identityProfile';
import {
    clearMemoryFiles,
    resetMemoryFilesStorageAdapter,
    setMemoryFilesStorageAdapter,
} from '../services/memory/memoryFiles';
import {
    clearMemoryRecallCache,
    retrieveMemory,
    type MemoryRoute,
} from '../services/memory/memoryRetrieval';
import { writeArtifact, writeJsonArtifact } from './shared/artifacts';
import { applyProbeEnv, probesEnabled } from './shared/loadEnv';
import {
    RECALL_NEEDLE_TOKEN,
    RECALL_PROBES,
    seedRecallLedger,
    type RecallProbe,
    type SeededRecallLedger,
} from './shared/recallLedger';

export interface R0LiveTurn {
    reply: string;
    /** Literal facts the reply had to carry to count as grounded. */
    factsChecked: readonly string[];
    factsFound: readonly string[];
    grounded: boolean;
    /** Which on-device tools the turn actually ran (activity stream). */
    toolNames: readonly string[];
    turnMs: number;
    rounds: number;
    toolsExecuted: number;
    usedTools: boolean;
    cumulativePromptTokens: number | null;
}

export interface R0ProbeRow {
    probeId: string;
    intent: string;
    question: string;
    route: MemoryRoute;
    routeExpected: RecallProbe['expectRoute'];
    routeCorrect: boolean;
    resolvedProjectId: string | null;
    selectedFileIds: readonly string[];
    expectedIds: readonly string[];
    selectedExpected: number;
    selectedDistractors: number;
    /** null when the probe carries no needle expectation. */
    hit: boolean | null;
    /** null when nothing was selected (nothing to be precise about). */
    precision: number | null;
    contextChars: number;
    /** Did the recalled context actually carry the facts the probe expects? */
    contextHasFacts: boolean;
    promptBytes: number;
    retrievalMs: number;
    toolMs: number;
    live: R0LiveTurn | null;
}

export interface R0Range {
    samples: number[];
    minMs: number;
    medianMs: number;
    p95Ms: number;
    maxMs: number;
}

export interface R0Metrics {
    /** Probes with a needle/thread expectation that surfaced it. */
    hitRate: { hits: number; probes: number; rate: number | null };
    precision: { mean: number | null; rows: number };
    grounding: { grounded: number; probes: number; rate: number | null; skipped: boolean };
    promptBytes: { median: number; p95: number; maxBytes: number; totalBytes: number };
    retrievalLatencyMs: R0Range;
    toolLatencyMs: R0Range;
    turnLatencyMs: (R0Range & { turns: number }) | null;
    routeAccuracy: { correct: number; probes: number; rate: number };
}

export interface R0Baseline {
    phase: 'R0';
    measuredAt: string;
    model: string;
    providerBaseUrl: string;
    live: boolean;
    offlineChecks: { hindsightBaseUrl: string; hindsightReachable: boolean; supabaseReachable: boolean };
    ledger: {
        files: number;
        needleIds: readonly string[];
        distractorIds: readonly string[];
        listOnlyIds: readonly string[];
        userIds: readonly string[];
        formalThreadIds: readonly string[];
        seedMs: number;
    };
    rows: R0ProbeRow[];
    metrics: R0Metrics;
    notes: string[];
}

/** Sub-millisecond resolution: in-memory recall often finishes inside one Date.now() tick. */
function nowMs(): number {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
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

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function p95(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
    return sorted[Math.max(0, index)]!;
}

function range(samples: number[]): R0Range {
    return {
        samples,
        minMs: Math.min(...samples),
        medianMs: median(samples),
        p95Ms: p95(samples),
        maxMs: Math.max(...samples),
    };
}

function expectedIdsFor(probe: RecallProbe, ledger: SeededRecallLedger): string[] {
    if (probe.expectedRoles.length === 0) return [];
    const ids = new Set<string>();
    // Thread ids lose their underscores when Dream promotes them, so compare loosely.
    const expectedThread = probe.expectProjectId?.replace(/_/g, '-');
    const pool = expectedThread
        ? ledger.files.filter((file) => file.projectId.replace(/_/g, '-') === expectedThread)
        : ledger.files;
    for (const role of probe.expectedRoles) {
        if (role === 'user') {
            ledger.userIds.forEach((id) => ids.add(id));
            continue;
        }
        pool.filter((file) => file.role === role && file.id).forEach((file) => ids.add(file.id!));
    }
    return [...ids];
}

async function reachable(url: string, timeoutMs = 1500): Promise<boolean> {
    try {
        await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
        return true;
    } catch {
        return false;
    }
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-word literal match — 'Sig' must not score on 'assigned'. */
function factsIn(text: string, facts: readonly string[]): string[] {
    const hay = text.toLowerCase();
    return facts.filter((fact) => new RegExp(`\\b${escapeRegExp(fact.toLowerCase())}\\b`).test(hay));
}

/** A live probe checks the planted token unless it declares its own facts. */
function factsFor(probe: RecallProbe): string[] {
    if (probe.expectedFacts && probe.expectedFacts.length > 0) return [...probe.expectedFacts];
    const wantsToken = probe.expectedRoles.some(
        (role) => role === 'needle' || role === 'list-only-needle',
    );
    return wantsToken ? [RECALL_NEEDLE_TOKEN] : [];
}

const LIVE_SYSTEM_PROMPT = [
    'You are a warm journal companion with an offline memory of the user\'s past.',
    'You MUST call memory_search before answering a question about the past; read what it returns and quote it exactly.',
    'Never invent memories. If recall returns nothing, say so plainly.',
].join(' ');

async function runLiveTurn(
    question: string,
    model: string | undefined,
    facts: readonly string[],
): Promise<R0LiveTurn> {
    const toolNames: string[] = [];
    const result = await runAgentTurnWithTools({
        systemPrompt: LIVE_SYSTEM_PROMPT,
        messages: [{ id: `r0-${Date.now()}`, role: 'user', content: question, timestamp: Date.now() }],
        generation: { temperature: 0.7, topP: 0.9, maxTokens: 2048 },
        model,
        maxRounds: 3,
        onActivity: (event) => {
            if (event.type === 'tool_call_start') toolNames.push(event.call.name);
        },
    });
    const reply = result.content ?? '';
    const factsFound = factsIn(reply, facts);
    return {
        reply,
        factsChecked: facts,
        factsFound,
        grounded: facts.length > 0 && factsFound.length > 0,
        toolNames,
        turnMs: result.timings?.turnMs ?? 0,
        rounds: result.rounds,
        toolsExecuted: result.timings?.toolsExecuted ?? 0,
        usedTools: result.usedTools,
        cumulativePromptTokens: result.cumulativePromptTokens ?? null,
    };
}

/**
 * Measure the fixed probe set against whatever is currently in the memory
 * store. Exported so phase comparisons (e.g. before/after Dream promotion) can
 * re-measure the same probes without re-seeding.
 */
export async function measureRecallProbes(
    ledger: SeededRecallLedger,
    options: { live: boolean; model?: string } = { live: false },
): Promise<R0ProbeRow[]> {
    const rows: R0ProbeRow[] = [];
    for (const probe of RECALL_PROBES) {
        const wantsLive = Boolean(probe.live) && options.live;
        clearMemoryRecallCache();

        const retrievalStarted = nowMs();
        const retrieval = await retrieveMemory(probe.question, { mode: 'explicit' });
        const retrievalMs = round2(nowMs() - retrievalStarted);

        const toolStarted = nowMs();
        const toolOutput = await memorySearchTool({ query: probe.question });
        const toolMs = round2(nowMs() - toolStarted);

        const facts = factsFor(probe);
        const contextHasFacts = facts.length > 0 && factsIn(retrieval.context, facts).length > 0;
        const selected = retrieval.debug.selectedFileIds;
        const expectedIds = expectedIdsFor(probe, ledger);
        const selectedExpected = selected.filter((id) => expectedIds.includes(id)).length;
        const selectedDistractors = selected.filter((id) => ledger.distractorIds.includes(id)).length;
        const hasExpectation = expectedIds.length > 0;

        rows.push({
            probeId: probe.id,
            intent: probe.intent,
            question: probe.question,
            route: retrieval.intent,
            routeExpected: probe.expectRoute,
            routeCorrect: probe.expectRoute === retrieval.intent,
            resolvedProjectId: retrieval.debug.resolvedProjectId ?? null,
            selectedFileIds: selected,
            expectedIds,
            selectedExpected,
            selectedDistractors,
            hit: hasExpectation ? selectedExpected > 0 : null,
            precision: selected.length > 0 ? selectedExpected / selected.length : null,
            contextChars: retrieval.context.length,
            contextHasFacts,
            promptBytes: Buffer.byteLength(toolOutput, 'utf8'),
            retrievalMs,
            toolMs,
            live: wantsLive ? await runLiveTurn(probe.question, options.model, facts) : null,
        });
    }
    return rows;
}

/** The six metrics, derived only from measured rows. */
export function computeRecallMetrics(rows: readonly R0ProbeRow[]): R0Metrics {
    const expectationRows = rows.filter((row) => row.hit !== null);
    const hits = expectationRows.filter((row) => row.hit === true).length;
    const precisionRows = rows.filter((row) => row.precision !== null);
    const liveRows = rows.filter((row) => row.live !== null);
    // Grounding is only meaningful when the model was actually handed the fact.
    const groundingRows = liveRows.filter((row) => row.contextHasFacts);

    return {
        hitRate: {
            hits,
            probes: expectationRows.length,
            rate: expectationRows.length ? hits / expectationRows.length : null,
        },
        precision: {
            mean: precisionRows.length
                ? precisionRows.reduce((total, row) => total + (row.precision ?? 0), 0) / precisionRows.length
                : null,
            rows: precisionRows.length,
        },
        grounding: {
            grounded: groundingRows.filter((row) => row.live?.grounded).length,
            probes: groundingRows.length,
            rate: groundingRows.length
                ? groundingRows.filter((row) => row.live?.grounded).length / groundingRows.length
                : null,
            skipped: groundingRows.length === 0,
        },
        promptBytes: {
            median: median(rows.map((row) => row.promptBytes)),
            p95: p95(rows.map((row) => row.promptBytes)),
            maxBytes: Math.max(...rows.map((row) => row.promptBytes)),
            totalBytes: rows.reduce((total, row) => total + row.promptBytes, 0),
        },
        retrievalLatencyMs: range(rows.map((row) => row.retrievalMs)),
        toolLatencyMs: range(rows.map((row) => row.toolMs)),
        turnLatencyMs: liveRows.length
            ? {
                ...range(liveRows.map((row) => row.live!.turnMs)),
                turns: liveRows.length,
            }
            : null,
        routeAccuracy: {
            correct: rows.filter((row) => row.routeCorrect).length,
            probes: rows.length,
            rate: rows.filter((row) => row.routeCorrect).length / rows.length,
        },
    };
}

/** Run the whole R0 battery. Caller owns adapters only if `manageAdapters` is false. */
export async function runR0RecallMetrics(
    options: { live?: boolean; writeArtifacts?: boolean } = {},
): Promise<R0Baseline> {
    const live = options.live ?? probesEnabled();
    const env = live ? applyProbeEnv() : null;
    const notes: string[] = [];

    setMemoryFilesStorageAdapter(memoryAdapter());
    setCustomModelStorageAdapter(memoryAdapter());
    setDayDigestStorageAdapter(memoryAdapter());
    setIdentityStorageAdapter(memoryAdapter());

    let ledger: SeededRecallLedger;
    const rows: R0ProbeRow[] = [];
    try {
        await clearMemoryFiles();
        ledger = await seedRecallLedger();

        rows.push(...await measureRecallProbes(ledger, { live, model: env?.model }));
    } finally {
        resetIdentityStorageAdapter();
        resetDayDigestStorageAdapter();
        resetCustomModelStorageAdapter();
        resetMemoryFilesStorageAdapter();
    }

    const metrics = computeRecallMetrics(rows);

    if (!live) {
        notes.push('Live metrics (grounding, whole-turn latency) skipped — PROBE_LLM=1 required.');
    }
    notes.push('Metrics are a baseline only: no floors are asserted, and the probe set is never tuned between runs.');
    notes.push('Grounding counts only live probes whose recalled context actually carried the expected fact (a recall miss is a hit-rate result, not a grounding miss).');
    notes.push('Recall path under test is offline-only; Hindsight/Supabase reachability is recorded for context, never required.');

    const baseline: R0Baseline = {
        phase: 'R0',
        measuredAt: new Date().toISOString(),
        model: env?.model ?? '(offline — no model)',
        providerBaseUrl: env?.apiBaseUrl ?? '(offline)',
        live,
        offlineChecks: {
            hindsightBaseUrl: process.env.EXPO_PUBLIC_AGENT_BASE_URL ?? 'http://localhost:8787',
            hindsightReachable: await reachable(process.env.EXPO_PUBLIC_AGENT_BASE_URL ?? 'http://localhost:8787'),
            supabaseReachable: await reachable(process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321'),
        },
        ledger: {
            files: ledger.files.length,
            needleIds: ledger.needleIds,
            distractorIds: ledger.distractorIds,
            listOnlyIds: ledger.listOnlyIds,
            userIds: ledger.userIds,
            formalThreadIds: ledger.formalThreadIds,
            seedMs: ledger.seedMs,
        },
        rows,
        metrics,
        notes,
    };

    if (options.writeArtifacts ?? live) {
        writeJsonArtifact('r0-recall-baseline.json', baseline);
        writeArtifact('r0-recall-baseline.md', formatBaselineMarkdown(baseline));
    }
    return baseline;
}

export function formatBaselineMarkdown(baseline: R0Baseline): string {
    const lines = [
        '# R0 — recall measurement baseline',
        '',
        `- measured: ${baseline.measuredAt}`,
        `- model: ${baseline.model} @ ${baseline.providerBaseUrl}`,
        `- live (PROBE_LLM): ${baseline.live}`,
        `- Hindsight reachable: ${baseline.offlineChecks.hindsightReachable} (${baseline.offlineChecks.hindsightBaseUrl})`,
        `- Supabase reachable: ${baseline.offlineChecks.supabaseReachable}`,
        `- ledger: ${baseline.ledger.files} files across ${baseline.ledger.formalThreadIds.length} threads (seed ${baseline.ledger.seedMs}ms)`,
        '',
        '## Six metrics',
        '',
        '| metric | value |',
        '|---|---|',
        `| hit-rate | ${fmtRate(baseline.metrics.hitRate.rate)} (${baseline.metrics.hitRate.hits}/${baseline.metrics.hitRate.probes}) |`,
        `| precision | ${fmtRate(baseline.metrics.precision.mean)} (${baseline.metrics.precision.rows} rows) |`,
        `| grounding | ${baseline.metrics.grounding.skipped ? 'skipped' : `${fmtRate(baseline.metrics.grounding.rate)} (${baseline.metrics.grounding.grounded}/${baseline.metrics.grounding.probes})`} |`,
        `| prompt bytes | median ${baseline.metrics.promptBytes.median}, p95 ${baseline.metrics.promptBytes.p95}, max ${baseline.metrics.promptBytes.maxBytes} |`,
        `| retrieval latency | median ${baseline.metrics.retrievalLatencyMs.medianMs}ms, p95 ${baseline.metrics.retrievalLatencyMs.p95Ms}ms, max ${baseline.metrics.retrievalLatencyMs.maxMs}ms |`,
        `| whole-turn latency | ${baseline.metrics.turnLatencyMs ? `median ${baseline.metrics.turnLatencyMs.medianMs}ms, p95 ${baseline.metrics.turnLatencyMs.p95Ms}ms over ${baseline.metrics.turnLatencyMs.turns} turns` : 'skipped'} |`,
        `| route accuracy (context) | ${fmtRate(baseline.metrics.routeAccuracy.rate)} |`,
        '',
        '## Per-probe',
        '',
        '| probe | route (expected) | selected | expected hit | distractors | ctx has facts | bytes | retrieval ms | grounded | tools | turn ms |',
        '|---|---|---|---|---|---|---|---|---|---|---|',
        ...baseline.rows.map((row) =>
            `| ${row.probeId} | ${row.route} (${row.routeExpected ?? 'any'}) | ${row.selectedFileIds.length} | ${row.hit === null ? '—' : row.hit} | ${row.selectedDistractors} | ${row.contextHasFacts} | ${row.promptBytes} | ${row.retrievalMs} | ${row.live ? row.live.grounded : '—'} | ${row.live ? row.live.toolNames.join('+') || 'none' : '—'} | ${row.live ? row.live.turnMs : '—'} |`,
        ),
        '',
        '## Verbatim live replies',
        '',
        ...(baseline.rows.filter((row) => row.live).length === 0
            ? ['(no live probes this run)']
            : baseline.rows
                .filter((row) => row.live)
                .flatMap((row) => [
                    `### ${row.probeId}`,
                    '',
                    `Q: ${row.question}`,
                    '',
                    `A: ${row.live!.reply}`,
                    '',
                    `facts checked: ${row.live!.factsChecked.join(', ') || '(none)'} · found: ${row.live!.factsFound.join(', ') || '(none)'} · tools: ${row.live!.toolNames.join(', ') || 'none'}`,
                    '',
                ])),
        '',
        '## Notes',
        '',
        ...baseline.notes.map((note) => `- ${note}`),
        '',
    ];
    return lines.join('\n');
}

function fmtRate(value: number | null): string {
    return value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`;
}
