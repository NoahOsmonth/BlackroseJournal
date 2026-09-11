/**
 * Live integration: tool-call syntax written as TEXT must never reach the UI.
 *
 * Real bug (glm 5.3 flash, live UI run 2026-09-10): the model emitted its call
 * with the tool name as the XML tag —
 *
 *     <search_history>
 *     { "query": "work", "top_k": 10 }
 *     </search_history>
 *
 * The parser only recognised wrapper tags (`<tool_call>`, `<invoke>`), so the
 * dump was neither executed nor flagged, and `stripToolCallSyntax` returned it
 * verbatim — the raw JSON shipped as the assistant reply.
 *
 * This probe runs the REAL agent loop against the real gateway and asserts both
 * halves of the fix: the dump becomes an executed call, and the user-visible
 * reply is prose. The coached case forces the exact leak shape (per the
 * sabotage-test doctrine: the fix only counts if the failure shape occurs).
 *
 * Run (PowerShell):
 *   $env:RUN_INTEGRATION_TESTS='1'
 *   npx jest --runInBand __tests__/integration/textToolDumpLeakLive.test.ts --forceExit
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

/** Any `<tool_name …>` shape: the leak form this probe exists to prevent. */
const TAG_DUMP_RE = /<\/?(get_clock|list_recent_days|get_day|get_conversation|search_history|recall_memory|get_identity|update_identity)\b/i;

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
    if (!apiKey) throw new Error('Missing EXPO_PUBLIC_NANO_GPT_API_KEY for live leak probe.');
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

interface LeakAttempt {
    reply: string;
    usedTools: boolean;
    rounds: number;
    toolCalls: string[];
    /** `origin` per executed call: 'text' proves the text parser produced it. */
    origins: string[];
}

const RETRY_DELAYS_MS = [60_000, 120_000, 240_000];

async function retryForAssertion(label: string, attempt: () => Promise<void>): Promise<void> {
    let lastError: unknown;
    for (let i = 0; i < RETRY_DELAYS_MS.length + 1; i += 1) {
        try {
            await attempt();
            return;
        } catch (error) {
            lastError = error;
            const message = error instanceof Error ? error.message : String(error);
            console.log(`[leak-live] ${label} attempt ${i + 1} failed: ${message}`);
            if (i < RETRY_DELAYS_MS.length) {
                await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[i]));
            }
        }
    }
    throw lastError;
}

describeMaybe('integration: text tool-dump leak (RUN_INTEGRATION_TESTS=1)', () => {
    jest.setTimeout(3_600_000);

    let liveModel = '';
    const originalEnv = process.env;

    beforeAll(() => {
        liveModel = applyLiveEnv();
        console.log(
            `[leak-live] provider=${process.env.EXPO_PUBLIC_NANO_GPT_API_BASE_URL} `
            + `model=${liveModel}`
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

    async function runProbe(userText: string, systemPromptOverride?: string): Promise<LeakAttempt> {
        const entry = await createEntry(workEntry());
        await upsertJournalDayDigest(entry);

        const systemPrompt = systemPromptOverride
            ?? FLOWS.freeform.buildSystemPrompt({
                now: Date.now(),
                recentDaysContext: await buildRecentDaysContext({ days: 3 }),
            });

        const messages: Message[] = [
            { id: 'u1', role: 'user', content: userText, timestamp: Date.now() },
        ];

        const attempt: LeakAttempt = {
            reply: '',
            usedTools: false,
            rounds: 0,
            toolCalls: [],
            origins: [],
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
                    if (event.type === 'tool_call_start') {
                        attempt.origins.push(`${event.call.name}:${event.call.origin ?? 'structured'}`);
                    }
                },
            });
            attempt.reply = agent.content;
            attempt.usedTools = agent.usedTools;
            attempt.rounds = agent.rounds;
        } finally {
            spy.mockRestore();
        }

        console.log(
            `[leak-live] rounds=${attempt.rounds} usedTools=${attempt.usedTools}\n`
            + `  calls: ${attempt.toolCalls.join(' | ') || '(none)'}\n`
            + `  origins: ${attempt.origins.join(' | ') || '(none)'}\n`
            + `  reply: ${attempt.reply.slice(0, 500)}`
        );
        return attempt;
    }

    it('never ships raw <tool_name> syntax when the model dumps a call as text', async () => {
        await activateAccount('live-leak-probe');

        await retryForAssertion('natural tag-dump case', async () => {
            const attempt = await runProbe(
                'What have I written about work lately? Look it up in my entries rather than guessing.'
            );

            // The user-visible reply is prose, never a tool tag.
            expect(attempt.reply).not.toMatch(TAG_DUMP_RE);
            expect(attempt.reply.trim().length).toBeGreaterThan(20);
        });
    });

    /**
     * Sabotage case: coach the model into the exact leak shape observed in the
     * live UI. If it complies, the tag dump must become an executed call
     * (origin='text') and still never reach the reply.
     */
    it('parses and executes a coached <tool_name> dump instead of leaking it', async () => {
        const coachingPrompt = [
            'You are a journaling companion with on-device history tools.',
            'HARD RULE: you may not use structured tool calls in this session.',
            'When you need history, write exactly one tool invocation as XML with the tool name',
            'as the tag and a JSON body, e.g.',
            '<search_history>',
            '{"query": "work"}',
            '</search_history>',
            'Write nothing else in that message.',
            'After the tool result arrives, answer the user in normal prose.',
            'Never invent results.',
        ].join(' ');

        await retryForAssertion('coached tag-dump case', async () => {
            const attempt = await runProbe(
                'What have I written about work lately? Look it up.',
                coachingPrompt
            );

            // Regardless of compliance, raw syntax never reaches the user.
            expect(attempt.reply).not.toMatch(TAG_DUMP_RE);
            expect(attempt.reply.trim().length).toBeGreaterThan(20);

            // When the coaching worked, the dump was executed — and provenance
            // says the text parser produced it (not the provider's tool_calls).
            const fromText = attempt.origins.some((o) => o.endsWith(':text'));
            expect(attempt.usedTools).toBe(true);
            expect(fromText).toBe(true);
            console.log(`[leak-live] coached: fromText=${fromText} origins=${attempt.origins.join(' | ')}`);
        });
    });
});
