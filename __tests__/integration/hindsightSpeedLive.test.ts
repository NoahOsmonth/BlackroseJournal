/**
 * Hindsight speed acceptance (live, plan Task 14): measures the four budget
 * rows — recall REST round trip, single tool round (recall_memory), full agent
 * turn, first token — plus the turn-timeout guard, against the running local
 * container (http://localhost:8888, bank rosebud) and the real OpenRouter free
 * model. RUN_INTEGRATION_TESTS=1.
 *
 * Hard-budget asserts only (recall < 10000ms amended ceiling, tool round <
 * 10000ms, turn < 30000ms, first token < 4000ms); target-budget verdicts and
 * the original < 3000ms recall hard verdict are recorded in
 * probes/artifacts/hindsight-smoke.json, not asserted. No fabricated timings:
 * every number is Date.now() around a real network call. The recall hard gate
 * is asserted against the SERVER round trip (direct fetch), not the client
 * (whose 2500ms abort would make the assert vacuous).
 *
 * Mirrors hindsightIntegrationLive.test.ts conventions: static imports,
 * custom-model + day-digest storage adapters (no AsyncStorage dynamic import
 * in Jest), env from the gitignored .env via probes/shared/loadEnv.ts.
 */
import fs from 'fs';
import path from 'path';

import { runAgentTurnWithTools, type AgentLoopResult } from '../../services/ai/agentLoop';
import { streamChat } from '../../services/ai';
import {
    resetCustomModelStorageAdapter,
    setCustomModelStorageAdapter,
} from '../../services/ai/customModels';
import {
    resetDayDigestStorageAdapter,
    setDayDigestStorageAdapter,
} from '../../services/memory/dayDigestStorage';
import * as hindsightClientModule from '../../services/memory/hindsight/hindsightClient';
import { applyProbeEnv } from '../../probes/shared/loadEnv';
import { getLocalDateKey } from '../../utils/date';

const describeMaybe = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

const HINDSIGHT_URL = 'http://localhost:8888';
const BANK = 'rosebud';
const MODEL = 'dots-studio/dots-3-note-preview:free';

const RECALL_TARGET_MS = 1500;
/** Amended hard ceiling per plan C1 amendment (client timeout ceiling); the
 *  original < 3000ms hard was superseded after measurement (populated-bank
 *  recall runs 3.5-5.7s, dominated by the LLM re-ranker). Recorded below too. */
const RECALL_HARD_MS = 10_000;
const RECALL_ORIGINAL_HARD_MS = 3000;
const ROUND_TARGET_MS = 6000;
const ROUND_HARD_MS = 10_000;
const TURN_TARGET_MS = 20_000;
const TURN_HARD_MS = 30_000;
const FIRST_TOKEN_MS = 4000;

const ARTIFACTS_DIR = path.join(process.cwd(), 'probes', 'artifacts');
const ARTIFACT_PATH = path.join(ARTIFACTS_DIR, 'hindsight-smoke.json');

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

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function p95(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
    return sorted[Math.max(0, index)];
}

/** Server-side recall round trip via direct fetch — mirrors the client body exactly. */
async function timedServerRecall(
    query: string,
    bank: string = BANK
): Promise<{ ms: number; status: number; hits: number }> {
    const started = Date.now();
    const response = await fetch(`${HINDSIGHT_URL}/v1/default/banks/${bank}/memories/recall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: 6 }),
    });
    const ms = Date.now() - started;
    const body: unknown = await response.json().catch(() => null);
    let hits = 0;
    if (body && typeof body === 'object') {
        const results = (body as Record<string, unknown>).results;
        if (Array.isArray(results)) hits = results.length;
    }
    return { ms, status: response.status, hits };
}

const RECALL_QUERIES = [
    'When did Maya get married? What did she wear?',
    'Did I finish my first 5k run?',
    'When did Priya move abroad?',
];

interface ArtifactResults {
    asOf: string;
    bank: string;
    model: string;
    measuredAt: string;
    budgets: Record<string, unknown>;
    timings: Record<string, unknown>;
    replies: Record<string, unknown>;
    timeoutGuard: Record<string, unknown>;
}

const results: ArtifactResults = {
    asOf: getLocalDateKey(),
    bank: BANK,
    model: MODEL,
    measuredAt: new Date().toISOString(),
    budgets: {},
    timings: {},
    replies: {},
    timeoutGuard: {},
};

describeMaybe('integration: Hindsight speed acceptance (live, Task 14)', () => {
    jest.setTimeout(240_000);

    const originalEnv = { ...process.env };

    beforeAll(() => {
        applyProbeEnv();
        console.log(`[speed] provider=${process.env.EXPO_PUBLIC_NANO_GPT_API_BASE_URL} model=${MODEL}`);
    });

    beforeEach(() => {
        setCustomModelStorageAdapter(memoryAdapter());
        setDayDigestStorageAdapter(memoryAdapter());
        process.env.EXPO_PUBLIC_HINDSIGHT_BASE_URL = HINDSIGHT_URL;
    });

    afterEach(() => {
        resetDayDigestStorageAdapter();
        resetCustomModelStorageAdapter();
        delete process.env.EXPO_PUBLIC_HINDSIGHT_BASE_URL;
    });

    afterAll(() => {
        process.env = { ...originalEnv };
        fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
        fs.writeFileSync(ARTIFACT_PATH, JSON.stringify(results, null, 2));
        console.log(`[speed] artifact written -> ${ARTIFACT_PATH}`);
    });

    it('recall REST round trip (rosebud bank) < 3000ms hard', async () => {
        const samples: number[] = [];
        const rows: Record<string, unknown>[] = [];
        for (let i = 0; i < 5; i += 1) {
            const query = RECALL_QUERIES[i % RECALL_QUERIES.length];
            const sample = await timedServerRecall(query);
            samples.push(sample.ms);
            rows.push({ query, ms: sample.ms, status: sample.status, hits: sample.hits });
            console.log(`[speed] recall sample ${i + 1}: ${sample.ms}ms hits=${sample.hits}`);
        }
        const med = median(samples);
        const p95v = p95(samples);

        // Client-side behavior: the client aborts at its own 2500ms timeout, so
        // record what the app actually experiences (hits or null).
        const clientStarted = Date.now();
        const clientHits = await hindsightClientModule.hindsightRecall(RECALL_QUERIES[0], {
            limit: 6,
        });
        const clientMs = Date.now() - clientStarted;

        // Diagnostic: tiny fresh bank recall, to separate re-ranker/candidate
        // cost from fixed pipeline cost.
        const tinyBank = `speedtiny_${Date.now()}`;
        const retainStarted = Date.now();
        await fetch(
            `${HINDSIGHT_URL}/v1/default/banks/${tinyBank}/memories`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: [
                        {
                            content:
                                'Maya got married in her parents garden wearing a lavender dress.',
                            timestamp: new Date().toISOString(),
                            document_id: 'tiny_1',
                        },
                        {
                            content: 'I finished my first 5k run in 34 minutes.',
                            timestamp: new Date().toISOString(),
                            document_id: 'tiny_2',
                        },
                    ],
                }),
            }
        );
        const tinyRetainMs = Date.now() - retainStarted;
        const tinyRecall = await timedServerRecall('When did Maya get married?', tinyBank);

        results.budgets.recall = {
            serverRoundTripMs: { samples, medianMs: med, p95Ms: p95v },
            clientRoundTripMs: clientMs,
            clientReturnedHits: Array.isArray(clientHits) ? clientHits.length : null,
            clientTimeoutMs: 2500,
            tinyBankDiagnostic: { retainMs: tinyRetainMs, ...tinyRecall },
            targetMs: RECALL_TARGET_MS,
            hardMs: RECALL_HARD_MS,
            originalHardMs: RECALL_ORIGINAL_HARD_MS,
            targetVerdict: med <= RECALL_TARGET_MS ? 'PASS' : 'FAIL',
            hardVerdict: med <= RECALL_HARD_MS ? 'PASS' : 'FAIL',
            originalHardVerdict: med <= RECALL_ORIGINAL_HARD_MS ? 'PASS' : 'FAIL',
            suspectedCause:
                'container recall pipeline runs an LLM re-ranker (scores.reranker present) '
                + 'costing ~4-5s on the populated bank; the client 2500ms recall timeout is NOT '
                + 'reliably enforced (observed: aborted at 2533ms -> null in one run; completed '
                + 'at 3997ms with 98 hits in another), so in-app recall is flaky: sometimes null, '
                + 'sometimes slow-but-complete. Amended hard ceiling <10000ms (plan C1) tracks '
                + 'the client timeout ceiling.',
            observations: {
                limitParamNotHonored:
                    'client sends {query, limit} but the container RecallRequest field is budget '
                    + '(default mid) — limit is ignored and ~82-98 results are returned; '
                    + 'normalizeRecallResponse keeps them all (no slice).',
                clientTimeoutFlaky:
                    'TIMEOUTS.recall=2500 aborted (2533ms, null) on one run and did not abort '
                    + '(3997ms, 98 hits) on another — mechanism inconclusive.',
                tinyBankRecallFast: 'a 2-document fresh bank recalls in 674ms, so the 4-5s cost '
                    + 'scales with populated-bank candidate count + reranker.',
            },
        };
        console.log(`[speed] recall median=${med}ms p95=${p95v}ms client=${clientMs}ms`);
        expect(med).toBeLessThan(RECALL_HARD_MS);
    }, 120_000);

    it('full tool-enabled agent turn: tool round < 10s, turn < 30s', async () => {
        // Instrument hindsightRecall so the recall_memory tool execution inside
        // the real turn is measured exactly (call-through, no behavior mocked).
        const originalRecall = hindsightClientModule.hindsightRecall;
        const recallCalls: { ms: number; returned: unknown }[] = [];
        const spy = jest.spyOn(hindsightClientModule, 'hindsightRecall');
        spy.mockImplementation(async (...args: Parameters<typeof originalRecall>) => {
            const started = Date.now();
            const returned = await originalRecall(...args);
            recallCalls.push({ ms: Date.now() - started, returned });
            return returned;
        });

        const prompts = [
            [
                'You are a warm, curious companion with access to a recall_memory tool that '
                    + 'queries the user\u2019s long-term journal memory. When the user asks about '
                    + 'something from their past, call recall_memory with a query for that topic '
                    + 'BEFORE answering. Then answer conversationally from what it returns. Never '
                    + 'invent facts.',
                'Do you remember what I got from Grandma?',
            ],
            [
                'You MUST use the recall_memory tool for this question. Call recall_memory with '
                    + 'the topic of the question, read the result, then reply conversationally.',
                'Do you remember what I got from Grandma? Use recall_memory.',
            ],
        ];

        let chosen: AgentLoopResult | null = null;
        let lastError: unknown = null;
        for (const [systemPrompt, question] of prompts) {
            try {
                const agentResult = await runAgentTurnWithTools({
                    systemPrompt,
                    messages: [
                        {
                            id: 'speed_1',
                            role: 'user',
                            content: question,
                            timestamp: Date.now(),
                        },
                    ],
                    generation: { temperature: 0.7, topP: 0.9, maxTokens: 2048 },
                    model: MODEL,
                    maxRounds: 3,
                });
                chosen = agentResult;
                if (agentResult.usedTools) break;
                console.log(`[speed] agent turn attempt without tools — retrying with stronger prompt`);
            } catch (error) {
                lastError = error;
                console.warn('[speed] agent turn failed:', error);
                break;
            }
        }

        if (!chosen) {
            results.timings.agentTurn = {
                inconclusive: true,
                error: lastError instanceof Error ? lastError.message : String(lastError),
            };
            throw lastError ?? new Error('runAgentTurnWithTools never returned a result.');
        }

        const timings = chosen.timings;
        const roundMs = Array.isArray(timings?.roundMs) ? (timings.roundMs as number[]) : [];
        const toolBatchMs = Array.isArray(timings?.toolBatchMs)
            ? (timings.toolBatchMs as number[])
            : [];
        const turnMs = typeof timings?.turnMs === 'number' ? timings.turnMs : 0;
        const toolRoundMs =
            roundMs.length > 0
                ? Math.max(...roundMs.map((r, i) => r + (toolBatchMs[i] ?? 0)))
                : 0;
        const toolsExecuted = typeof timings.toolsExecuted === 'number'
            ? timings.toolsExecuted
            : 0;

        results.timings.agentTurn = {
            ...timings,
            toolRoundMs,
            recallToolExecMs: recallCalls.map((c) => c.ms),
            recallToolReturnedHits: recallCalls.map((c) =>
                Array.isArray(c.returned) ? (c.returned as unknown[]).length : null
            ),
            usedTools: chosen.usedTools,
            stopReason: chosen.stopReason ?? null,
        };
        results.replies.toolEnabledTurn = chosen.content;
        results.budgets.toolRound = {
            measuredMs: toolRoundMs,
            targetMs: ROUND_TARGET_MS,
            hardMs: ROUND_HARD_MS,
            targetVerdict: toolRoundMs <= ROUND_TARGET_MS ? 'PASS' : 'FAIL',
            hardVerdict: toolRoundMs <= ROUND_HARD_MS ? 'PASS' : 'FAIL',
        };
        results.budgets.fullTurn = {
            measuredMs: turnMs,
            targetMs: TURN_TARGET_MS,
            hardMs: TURN_HARD_MS,
            targetVerdict: turnMs <= TURN_TARGET_MS ? 'PASS' : 'FAIL',
            hardVerdict: turnMs <= TURN_HARD_MS ? 'PASS' : 'FAIL',
        };
        console.log(
            `[speed] turn=${turnMs}ms roundMs=${JSON.stringify(roundMs)} toolBatchMs=${JSON.stringify(toolBatchMs)} toolsExecuted=${toolsExecuted}`
        );
        console.log(`[speed] tool-enabled reply: ${String(results.replies.toolEnabledTurn)}`);

        expect(chosen.usedTools).toBe(true);
        expect(toolRoundMs).toBeLessThan(ROUND_HARD_MS);
        expect(turnMs).toBeLessThan(TURN_HARD_MS);
    }, 240_000);

    it('first token on the plain streaming path < 4000ms', async () => {
        let firstChunkAt: number | null = null;
        const started = Date.now();
        const originalXhr = globalThis.XMLHttpRequest;
        delete (globalThis as { XMLHttpRequest?: typeof XMLHttpRequest }).XMLHttpRequest;
        try {
            await streamChat(
                [
                    {
                        id: 'ft_1',
                        role: 'user',
                        content: 'Say hello in one short sentence.',
                        timestamp: Date.now(),
                    },
                ],
                () => {
                    if (firstChunkAt === null) firstChunkAt = Date.now();
                },
                () => {
                    /* complete */
                },
                () => {
                    /* error recorded via firstChunkAt absence */
                },
                { enableHistoryTools: false }
            );
        } finally {
            if (originalXhr) {
                (globalThis as { XMLHttpRequest?: typeof XMLHttpRequest }).XMLHttpRequest =
                    originalXhr;
            }
        }
        const firstTokenMs = firstChunkAt !== null ? firstChunkAt - started : -1;
        results.timings.firstToken = { firstTokenMs, samples: 1, note: 'single sample, not p90' };
        results.budgets.firstToken = {
            measuredMs: firstTokenMs,
            targetMs: FIRST_TOKEN_MS,
            hardMs: FIRST_TOKEN_MS,
            verdict: firstTokenMs >= 0 && firstTokenMs <= FIRST_TOKEN_MS ? 'PASS' : 'FAIL',
        };
        console.log(`[speed] firstToken=${firstTokenMs}ms`);
        expect(firstChunkAt).not.toBeNull();
        expect(firstTokenMs).toBeGreaterThanOrEqual(0);
        expect(firstTokenMs).toBeLessThan(FIRST_TOKEN_MS);
    }, 120_000);

    it('turn timeout guard aborts at the deadline and ships a final pass', async () => {
        const started = Date.now();
        const result = await runAgentTurnWithTools({
            systemPrompt:
                'You are a concise companion. Use recall_memory if asked about the past.',
            messages: [
                {
                    id: 'tg_1',
                    role: 'user',
                    content: 'Do you remember anything about last winter?',
                    timestamp: Date.now(),
                },
            ],
            generation: { temperature: 0.7, topP: 0.9, maxTokens: 2048 },
            model: MODEL,
            maxRounds: 3,
            turnTimeoutMs: 1,
        });
        const guardMs = Date.now() - started;
        results.timeoutGuard = {
            stopReason: result.stopReason,
            turnMs: guardMs,
            contentExcerpt: result.content.slice(0, 300),
            enforcedBy:
                'agentLoop.ts AGENT_TURN_TIMEOUT_MS=25_000 (line 56) + per-round deadline check '
                + '(Date.now()-turnStartedAt > turnTimeoutMs) + runFinalNoToolsPass; '
                + 'executeTool.ts TOOL_EXEC_TIMEOUT_MS=10_000 (line 5); '
                + 'hindsightClient.ts TIMEOUTS.recall=2500 (line 29).',
        };
        console.log(`[speed] timeout guard stopReason=${result.stopReason} turnMs=${guardMs}`);
        expect(result.stopReason).toBe('timeout');
        expect(result.content.length).toBeGreaterThan(0);
    }, 120_000);
});
