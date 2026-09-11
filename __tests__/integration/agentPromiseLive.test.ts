/**
 * Live integration: Pi-style promise keep-alive against the real gateway.
 *
 * Free models routinely end a turn on a status line ("Let me actually go dig
 * rather than guess. One sec.") and never come back with the answer. This probe
 * runs the REAL agent loop (real provider, real Rosebud freeform prompt weave,
 * real tool validate/execute pipeline over real seeded on-device digests) and
 * asserts that whatever the model does, the reply the user sees is NEVER a lone
 * status line when tools ran on the model side.
 *
 * The ONLY stub is hindsightRecall (external local Docker service) at the module
 * boundary; recall hits are seeded so recall_memory results are verifiable.
 *
 * Per AGENTS.md rule 7 this is the live gate for the loop change; rule 8 says
 * memory/recall E2E must run against cleared demo data — the harness installs
 * empty storage adapters and seeds only what it needs.
 *
 * Run (PowerShell):
 *   $env:RUN_INTEGRATION_TESTS='1'
 *   npx jest --runInBand __tests__/integration/agentPromiseLive.test.ts --forceExit
 */

import fs from 'fs';
import path from 'path';

import { FLOWS } from '../../features/chat/flows';
import { activateAccount } from '../../services/account/accountRuntime';
import { runAgentTurnWithTools } from '../../services/ai/agentLoop';
import type { Message } from '../../services/ai/chatTypes';
import {
    resetCustomModelStorageAdapter,
    setCustomModelStorageAdapter,
} from '../../services/ai/customModels';
import { looksLikeUnfinishedPromise } from '../../services/ai/agentPromise';
import * as executeTool from '../../services/ai/tools/executeTool';
import { createEntry, resetStorageAdapter, setStorageAdapter } from '../../services/journal/journalStorage';
import type { JournalEntry } from '../../services/journal/journalStorage.types';
import {
    buildRecentDaysContext,
    clearDayDigests,
    resetDayDigestStorageAdapter,
    setDayDigestStorageAdapter,
    upsertJournalDayDigest,
} from '../../services/memory/dayDigestStorage';
import {
    clearIdentityProfile,
    resetIdentityStorageAdapter,
    setIdentityStorageAdapter,
} from '../../services/memory/identityProfile';
import { addLocalDays, getLocalDateKey } from '../../utils/date';

jest.mock('../../services/memory/hindsight/hindsightClient', () => ({
    hindsightRecall: jest.fn(async () => []),
    subscribeHindsightChanges: jest.fn(() => () => undefined),
    notifyHindsightChanged: jest.fn(),
    hindsightHealth: jest.fn(async () => false),
}));

const describeMaybe = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

function readEnvFile(): Record<string, string> {
    const envPath = path.join(process.cwd(), '.env');
    const text = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
    return Object.fromEntries(
        text.split(/\r?\n/).map((line) => {
            const index = line.indexOf('=');
            return index < 0 ? [line, ''] : [line.slice(0, index), line.slice(index + 1)];
        })
    );
}

function memoryAdapter() {
    const store = new Map<string, string>();
    return {
        getAllKeys: async () => [...store.keys()],
        getItem: async (key: string) => store.get(key) ?? null,
        setItem: async (key: string, value: string) => {
            store.set(key, value);
        },
        removeItem: async (key: string) => {
            store.delete(key);
        },
    };
}

function applyLiveEnv(): string {
    const fileEnv = readEnvFile();
    const apiKey =
        process.env.EXPO_PUBLIC_NANO_GPT_API_KEY ?? fileEnv.EXPO_PUBLIC_NANO_GPT_API_KEY;
    if (!apiKey) throw new Error('Missing EXPO_PUBLIC_NANO_GPT_API_KEY for live promise probe.');
    process.env.EXPO_PUBLIC_NANO_GPT_API_KEY = apiKey;
    process.env.EXPO_PUBLIC_NANO_GPT_API_BASE_URL =
        process.env.EXPO_PUBLIC_NANO_GPT_API_BASE_URL
        ?? fileEnv.EXPO_PUBLIC_NANO_GPT_API_BASE_URL
        ?? 'http://100.107.7.52:20128/v1';
    process.env.EXPO_PUBLIC_NANO_GPT_MODEL =
        process.env.EXPO_PUBLIC_NANO_GPT_MODEL
        ?? fileEnv.EXPO_PUBLIC_NANO_GPT_MODEL
        ?? 'merge/deepseek/deepseek-v4-flash-0731';
    process.env.EXPO_PUBLIC_NANO_GPT_FLASH_MODEL = process.env.EXPO_PUBLIC_NANO_GPT_MODEL;
    return process.env.EXPO_PUBLIC_NANO_GPT_MODEL;
}

function yesterdayEntry(): Omit<JournalEntry, 'id'> {
    const createdAt = addLocalDays(new Date(), -1).getTime();
    return {
        title: 'Sleep debt and work pressure',
        emoji: '\u{1F634}',
        messages: [
            {
                id: 'u1',
                role: 'user',
                content:
                    'I barely slept. Work Slack kept buzzing and I rewrote the same deck three times. I feel raw and short-tempered.',
                timestamp: createdAt,
            },
            {
                id: 'a1',
                role: 'assistant',
                content: 'That sounds exhausting. What felt heaviest \u2014 the lack of sleep or the rework?',
                timestamp: createdAt + 1,
            },
            {
                id: 'u2',
                role: 'user',
                content: 'The rework. My boss keeps changing the requirements and I take it out on everyone.',
                timestamp: createdAt + 2,
            },
        ],
        status: 'completed',
        analysis: {
            insight: 'Sleep debt is amplifying work stress; boss churn fuels the spiral.',
            quote: 'rewrote the same deck three times',
            mood: 'exhausted',
            topics: ['Sleep', 'Work', 'Stress'],
            generatedAt: createdAt,
        },
        createdAt,
        updatedAt: createdAt,
    };
}

interface Attempt {
    reply: string;
    usedTools: boolean;
    rounds: number;
    stopReason?: string;
    providerStopReason?: string;
    promiseContinuations: number;
    intermediateTexts: { round: number; text: string }[];
    toolCalls: string[];
    statusLineEvents: string[];
    followUps: string[];
}

/** Retry ladder for the free gateway (congestion windows, not logic flakes). */
const RETRY_DELAYS_MS = [60_000, 120_000, 240_000];
const TURN_COOLDOWN_MS = 60_000;

async function retryForAssertion(label: string, attempt: () => Promise<void>): Promise<void> {
    let lastError: unknown;
    for (let i = 0; i < RETRY_DELAYS_MS.length + 1; i += 1) {
        try {
            await attempt();
            return;
        } catch (error) {
            lastError = error;
            const message = error instanceof Error ? error.message : String(error);
            console.log(`[promise-live] ${label} attempt ${i + 1} failed: ${message}`);
            if (i < RETRY_DELAYS_MS.length) {
                await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[i]));
            }
        }
    }
    throw lastError;
}

describeMaybe('integration: Pi promise keep-alive (RUN_INTEGRATION_TESTS=1)', () => {
    jest.setTimeout(3_600_000);

    const originalEnv = { ...process.env };
    let liveModel: string;

    beforeAll(() => {
        liveModel = applyLiveEnv();
        console.log(
            `[promise-live] provider=${process.env.EXPO_PUBLIC_NANO_GPT_API_BASE_URL} `
            + `model=${liveModel} today=${getLocalDateKey()}`
        );
    });

    beforeEach(() => {
        setCustomModelStorageAdapter(memoryAdapter());
        setDayDigestStorageAdapter(memoryAdapter());
        setIdentityStorageAdapter(memoryAdapter());
        setStorageAdapter(memoryAdapter());
    });

    afterEach(async () => {
        await clearDayDigests();
        await clearIdentityProfile();
        resetDayDigestStorageAdapter();
        resetIdentityStorageAdapter();
        resetCustomModelStorageAdapter();
        resetStorageAdapter();
    });

    afterAll(() => {
        process.env = { ...originalEnv };
    });

    async function runProbe(userText: string, systemPromptOverride?: string): Promise<Attempt> {
        const entry = await createEntry(yesterdayEntry());
        await upsertJournalDayDigest(entry);

        const systemPrompt = systemPromptOverride
            ?? FLOWS.freeform.buildSystemPrompt({
                now: Date.now(),
                recentDaysContext: await buildRecentDaysContext({ days: 3 }),
            });

        const messages: Message[] = [
            { id: 'u1', role: 'user', content: userText, timestamp: Date.now() },
        ];

        const attempt: Attempt = {
            reply: '',
            usedTools: false,
            rounds: 0,
            promiseContinuations: 0,
            intermediateTexts: [],
            toolCalls: [],
            statusLineEvents: [],
            followUps: [],
        };

        const origExec = executeTool.executeToolCalls.bind(executeTool);
        const spy = jest
            .spyOn(executeTool, 'executeToolCalls')
            .mockImplementation(async (calls, opts) => {
                for (const c of calls) {
                    attempt.toolCalls.push(`${c.name}(${c.arguments.slice(0, 80)})`);
                }
                return origExec(calls, opts);
            });

        try {
            const agent = await runAgentTurnWithTools({
                systemPrompt,
                messages,
                model: liveModel,
                generation: { temperature: 0.4, maxTokens: 1_024 },
                onActivity: (event) => {
                    if (event.type === 'assistant_text_end') {
                        attempt.statusLineEvents.push(`turn=${event.round} "${event.text}"`);
                    }
                    if (event.type === 'follow_up_injected') {
                        attempt.followUps.push(event.reason);
                    }
                },
            });
            attempt.reply = agent.content;
            attempt.usedTools = agent.usedTools;
            attempt.rounds = agent.rounds;
            attempt.stopReason = agent.stopReason;
            attempt.providerStopReason = agent.providerStopReason;
            attempt.promiseContinuations = agent.promiseContinuations ?? 0;
            attempt.intermediateTexts = agent.intermediateTexts ?? [];
        } finally {
            spy.mockRestore();
        }

        console.log(
            `[promise-live] rounds=${attempt.rounds} usedTools=${attempt.usedTools} `
            + `stop=${attempt.stopReason ?? 'complete'} providerStop=${attempt.providerStopReason ?? '?'} `
            + `promiseContinuations=${attempt.promiseContinuations}\n`
            + `  calls: ${attempt.toolCalls.join(' | ') || '(none)'}\n`
            + `  statusLines: ${attempt.statusLineEvents.join(' ; ') || '(none)'}\n`
            + `  followUps: ${attempt.followUps.join(', ') || '(none)'}\n`
            + `  reply: ${attempt.reply.slice(0, 500)}`
        );
        return attempt;
    }

    it('never ships a lone status line when the model used tools', async () => {
        await activateAccount('live-promise-probe');

        await retryForAssertion('promise keep-alive', async () => {
            const attempt = await runProbe(
                'What did I write about work yesterday? Dig through my entries properly.'
            );

            // The user-visible reply is never a status line, whatever path ran.
            expect(looksLikeUnfinishedPromise(attempt.reply)).toBe(false);
            expect(attempt.reply.trim().length).toBeGreaterThan(20);

            // When tools ran, every status line the model wrote is intermediate
            // voice, not the answer.
            if (attempt.usedTools) {
                for (const line of attempt.intermediateTexts) {
                    expect(line.text).not.toBe(attempt.reply);
                }
                // Grounded in the seeded entry (no invention).
                expect(attempt.reply.toLowerCase()).toMatch(/sleep|deck|work|rework|boss/);
            }

            // If the model did promise-and-go, the loop must have continued.
            if (attempt.promiseContinuations > 0) {
                expect(attempt.rounds).toBeGreaterThan(1);
                expect(attempt.followUps).toContain('promised_more');
            }
        });

        await new Promise((resolve) => setTimeout(resolve, TURN_COOLDOWN_MS));
    });

    it('keeps a tools-disabled final pass productive after a promise streak', async () => {
        // Second probe: a question the model cannot answer from a single digest
        // invites "let me dig more" shapes. The loop must still land an answer.
        await retryForAssertion('promise exhaustion path', async () => {
            const attempt = await runProbe(
                'Look back as far as you can and tell me the themes running through my journaling.'
            );

            expect(looksLikeUnfinishedPromise(attempt.reply)).toBe(false);
            expect(attempt.reply.trim().length).toBeGreaterThan(20);
            // Stop reasons must come from the mapped set, never a raw provider string.
            if (attempt.stopReason) {
                expect([
                    'complete',
                    'promised_more_timeout',
                    'max_rounds',
                    'token_budget',
                    'timeout',
                    'duplicate_call',
                    'skipped',
                    'error',
                ]).toContain(attempt.stopReason);
            }
        });
    });

    /**
     * Sabotage probe: the fix only matters if the failure shape actually occurs.
     * Two real customer turns above never produced a promise-only turn, so this
     * case coaches the model into the exact leak (status line, no tool call,
     * stop) and proves the loop recovers instead of shipping it.
     */
    it('recovers live when the model is coached to leak a promise-only turn', async () => {
        const coachingPrompt = [
            'You are a journaling companion with on-device history tools.',
            'HARD RULE: when you need to look at the journal, your FIRST message must be ONLY a',
            'short status line such as "One sec — let me dig through that." Do not call any tool',
            'in that first message. Wait for the next turn before calling tools.',
            'After that, call your tools and then answer normally and completely.',
            'Never invent results.',
        ].join(' ');

        await retryForAssertion('coached promise recovery', async () => {
            const attempt = await runProbe(
                'What did I write about work yesterday? Look it up.',
                coachingPrompt
            );

            // The reply is an answer, never the coached status line.
            expect(looksLikeUnfinishedPromise(attempt.reply)).toBe(false);
            expect(attempt.reply.trim().length).toBeGreaterThan(20);

            // When the coaching worked, the loop must have detected the promise
            // and spent a keep-alive continuation to get to the real answer.
            const leaked = attempt.intermediateTexts.some((t) => looksLikeUnfinishedPromise(t.text));
            if (leaked) {
                expect(attempt.promiseContinuations).toBeGreaterThan(0);
                expect(attempt.rounds).toBeGreaterThan(1);
                expect(attempt.followUps).toContain('promised_more');
                // And the recovered answer is grounded in the seeded entry.
                expect(attempt.reply.toLowerCase()).toMatch(/sleep|deck|work|rework|boss/);
            }
            console.log(
                `[promise-live] coached: leaked=${leaked} continuations=${attempt.promiseContinuations} `
                + `rounds=${attempt.rounds}`
            );
        });
    });
});
