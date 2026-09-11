/**
 * Live integration: capability tiers are per-MODEL on OmniRoute (Plan v2 §4.3).
 *
 * The same gateway URL serves weak cookie models that dump tool syntax as text
 * and strong API models that return native structured `tool_calls`. A tier
 * probe must show the difference, otherwise the tiers are just decoration.
 *
 * Tier A case: a Claude model routed through OmniRoute must resolve to
 * `structured`, deliver `origin: 'structured'` calls, produce a real answer,
 * and — because its dumps are never rejected by the tools API — never need the
 * free-model dump nudge.
 *
 * Run (PowerShell):
 *   $env:RUN_INTEGRATION_TESTS='1'
 *   npx jest --runInBand __tests__/integration/agentTierLive.test.ts --forceExit
 * Override the tier A model:
 *   $env:TIER_A_MODEL='antigravity/claude-sonnet-4-6'
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
import * as executeTool from '../../services/ai/tools/executeTool';
import { resolveToolCapability } from '../../services/ai/tools/toolCapability';
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
import { addLocalDays } from '../../utils/date';

jest.mock('../../services/memory/hindsight/hindsightClient', () => ({
    hindsightRecall: jest.fn(async () => []),
    subscribeHindsightChanges: jest.fn(() => () => undefined),
    notifyHindsightChanged: jest.fn(),
    hindsightHealth: jest.fn(async () => false),
}));

const describeMaybe = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

/** Default tier A model proven routable on this gateway (native tool_calls). */
const TIER_A_MODEL = process.env.TIER_A_MODEL ?? 'antigravity/claude-sonnet-4-6';
/**
 * A genuinely dump-prone free route — the hybrid tier. Pinned explicitly
 * rather than read from EXPO_PUBLIC_NANO_GPT_MODEL: the app default is now a
 * structured route (native tool_calls + native json_object).
 */
const TIER_B_MODEL = process.env.TIER_B_MODEL ?? 'merge/zai/glm-5.3-flash';

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

function applyLiveEnv(): void {
    const fileEnv = readEnvFile();
    const apiKey =
        process.env.EXPO_PUBLIC_NANO_GPT_API_KEY ?? fileEnv.EXPO_PUBLIC_NANO_GPT_API_KEY;
    if (!apiKey) throw new Error('Missing EXPO_PUBLIC_NANO_GPT_API_KEY for live tier probe.');
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
}

function workEntry(): Omit<JournalEntry, 'id'> {
    const createdAt = addLocalDays(new Date(), -1).getTime();
    return {
        title: 'Quiet doubt about the new role',
        emoji: '\u{1F4BC}',
        messages: [
            {
                id: 'u1',
                role: 'user',
                content:
                    'Started the new position and I am excited, but there is a low hum of "do I belong here?" I keep comparing myself to people with more years of experience.',
                timestamp: createdAt,
            },
        ],
        status: 'completed',
        analysis: {
            insight: 'New role brings impostor hum; comparison is the trigger.',
            quote: 'do I belong here?',
            mood: 'anxious',
            topics: ['Work', 'New role'],
            generatedAt: createdAt,
        },
        createdAt,
        updatedAt: createdAt,
    };
}

interface TierAttempt {
    reply: string;
    rounds: number;
    usedTools: boolean;
    capabilityMode: string;
    origins: string[];
}

const RETRY_DELAYS_MS = [60_000, 120_000];

async function retryForAssertion(label: string, attempt: () => Promise<void>): Promise<void> {
    let lastError: unknown;
    for (let i = 0; i < RETRY_DELAYS_MS.length + 1; i += 1) {
        try {
            await attempt();
            return;
        } catch (error) {
            lastError = error;
            const message = error instanceof Error ? error.message : String(error);
            console.log(`[tier-live] ${label} attempt ${i + 1} failed: ${message}`);
            if (i < RETRY_DELAYS_MS.length) {
                await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[i]));
            }
        }
    }
    throw lastError;
}

describeMaybe('integration: per-model capability tiers (RUN_INTEGRATION_TESTS=1)', () => {
    jest.setTimeout(3_600_000);

    const originalEnv = process.env;

    beforeAll(() => {
        applyLiveEnv();
        console.log(
            `[tier-live] base=${process.env.EXPO_PUBLIC_NANO_GPT_API_BASE_URL} `
            + `tierA=${TIER_A_MODEL} (${resolveToolCapability(TIER_A_MODEL).mode}) `
            + `tierB=${process.env.EXPO_PUBLIC_NANO_GPT_MODEL} `
            + `(${resolveToolCapability(process.env.EXPO_PUBLIC_NANO_GPT_MODEL).mode})`
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

    async function runTurn(modelId: string, userText: string): Promise<TierAttempt> {
        const entry = await createEntry(workEntry());
        await upsertJournalDayDigest(entry);

        const systemPrompt = FLOWS.freeform.buildSystemPrompt({
            now: Date.now(),
            recentDaysContext: await buildRecentDaysContext({ days: 3 }),
        });
        const messages: Message[] = [
            { id: 'u1', role: 'user', content: userText, timestamp: Date.now() },
        ];

        const attempt: TierAttempt = {
            reply: '',
            rounds: 0,
            usedTools: false,
            capabilityMode: resolveToolCapability(modelId).mode,
            origins: [],
        };

        const origExec = executeTool.executeToolCalls.bind(executeTool);
        const spy = jest
            .spyOn(executeTool, 'executeToolCalls')
            .mockImplementation(async (calls, opts) => origExec(calls, opts));

        try {
            const agent = await runAgentTurnWithTools({
                systemPrompt,
                messages,
                model: modelId,
                generation: { temperature: 0.3, maxTokens: 1_024 },
                onActivity: (event) => {
                    if (event.type === 'tool_call_start') {
                        attempt.origins.push(`${event.call.name}:${event.call.origin ?? 'structured'}`);
                    }
                },
            });
            attempt.reply = agent.content;
            attempt.rounds = agent.rounds;
            attempt.usedTools = agent.usedTools;
        } finally {
            spy.mockRestore();
        }

        console.log(
            `[tier-live] model=${modelId} mode=${attempt.capabilityMode} rounds=${attempt.rounds} `
            + `usedTools=${attempt.usedTools}\n`
            + `  origins: ${attempt.origins.join(' | ') || '(none)'}\n`
            + `  reply: ${attempt.reply.slice(0, 400)}`
        );
        return attempt;
    }

    it('routes a strong model to structured and gets native tool calls', async () => {
        await activateAccount('live-tier-probe');

        await retryForAssertion('tier A structured path', async () => {
            const attempt = await runTurn(
                TIER_A_MODEL,
                'What have I written about work lately? Look it up in my entries.'
            );

            // Per-model routing, not per-gateway: this model is tier A.
            expect(attempt.capabilityMode).toBe('structured');
            expect(attempt.reply.trim().length).toBeGreaterThan(20);
            // No raw syntax ever.
            expect(attempt.reply).not.toMatch(/<\s*(?:search_history|get_day|tool_call)\b/i);

            if (attempt.usedTools) {
                // Tier A delivers through the tools API — never the text parser.
                expect(attempt.origins.every((o) => o.endsWith(':structured'))).toBe(true);
            }
            // The loop must terminate well inside its round ceiling. Deliberately
            // not a tight cap: a legitimately tool-heavy turn runs 4 rounds.
            expect(attempt.rounds).toBeLessThanOrEqual(6);
        });
    });

    it('keeps a weak free model on the hybrid tier in the same run', async () => {
        expect(resolveToolCapability(TIER_B_MODEL).mode).toBe('hybrid');

        await retryForAssertion('tier B hybrid path', async () => {
            const attempt = await runTurn(
                TIER_B_MODEL,
                'What have I written about work lately? Look it up in my entries.'
            );

            expect(attempt.capabilityMode).toBe('hybrid');
            expect(attempt.reply.trim().length).toBeGreaterThan(20);
            expect(attempt.reply).not.toMatch(/<\s*(?:search_history|get_day|tool_call)\b/i);
        });
    });
});
