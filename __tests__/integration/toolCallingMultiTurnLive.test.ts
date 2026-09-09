/**
 * Live integration: 3-turn sequential conversation — tool-calling ACCURACY probe.
 * Real OmniRoute model + real Rosebud freeform prompt weave + real agent loop +
 * real tool validate/execute pipeline over real seeded on-device digests.
 *
 * The ONLY stub is hindsightRecall (external local Docker service) at the module
 * boundary; recall hits are seeded so recall_memory results can be verified by
 * needle-echo in the reply. Nothing else is mocked: the spy on executeToolCalls
 * logs and calls through to the real handlers.
 *
 * Per turn we assert the RIGHT tool fired with the RIGHT arguments, and that the
 * final reply is grounded in the tool results (no loop narration leaked).
 *
 * Run (PowerShell):
 *   $env:RUN_INTEGRATION_TESTS='1'
 *   npx jest --runInBand __tests__/integration/toolCallingMultiTurnLive.test.ts --forceExit
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
import { hindsightRecall } from '../../services/memory/hindsight/hindsightClient';
import {
    clearIdentityProfile,
    resetIdentityStorageAdapter,
    setIdentityStorageAdapter,
} from '../../services/memory/identityProfile';
import { addLocalDays, getLocalDateKey } from '../../utils/date';

jest.mock('../../services/memory/hindsight/hindsightClient', () => ({
    hindsightRecall: jest.fn(),
    subscribeHindsightChanges: jest.fn(() => () => undefined),
    notifyHindsightChanged: jest.fn(),
    hindsightHealth: jest.fn(async () => false),
}));

const mockedRecall = hindsightRecall as jest.MockedFunction<typeof hindsightRecall>;
const describeMaybe = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

/** Distinct needle proving recall_memory results actually reached the reply. */
const NEEDLE_MEMORY =
    'your grandmother\u2019s blue enamel teapot from the Lisbon trip (Written 2024-11-02)';

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
    if (!apiKey) throw new Error('Missing EXPO_PUBLIC_NANO_GPT_API_KEY for live tool-accuracy probe.');
    process.env.EXPO_PUBLIC_NANO_GPT_API_KEY = apiKey;
    process.env.EXPO_PUBLIC_NANO_GPT_API_BASE_URL =
        process.env.EXPO_PUBLIC_NANO_GPT_API_BASE_URL
        ?? fileEnv.EXPO_PUBLIC_NANO_GPT_API_BASE_URL
        ?? 'http://100.107.7.52:20128/v1';
    process.env.EXPO_PUBLIC_NANO_GPT_MODEL =
        process.env.EXPO_PUBLIC_NANO_GPT_MODEL
        ?? fileEnv.EXPO_PUBLIC_NANO_GPT_MODEL
        ?? 'cl/dots-studio/dots-3-note-preview:free';
    process.env.EXPO_PUBLIC_NANO_GPT_FLASH_MODEL = process.env.EXPO_PUBLIC_NANO_GPT_MODEL;
    return process.env.EXPO_PUBLIC_NANO_GPT_MODEL;
}

function yesterdayEntry(): JournalEntry {
    const createdAt = addLocalDays(new Date(), -1).getTime();
    return {
        id: 'live-mt-sleep',
        title: 'Sleep debt and work pressure',
        emoji: '😴',
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
                content: 'That sounds exhausting. What felt heaviest — the lack of sleep or the rework?',
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

interface TurnProbe {
    toolCalls: { name: string; args: string }[];
    toolResults: { name: string; isError: boolean; preview: string; full: string }[];
    reply: string;
    usedTools: boolean;
    rounds: number;
    toolCallSource: string;
    stopReason?: string;
}

/**
 * Runs one conversation turn through the REAL agent loop with the REAL tool
 * pipeline. Logs every tool call + result into `probe` (call-through spy —
 * nothing about execution is faked).
 */
async function runTurn(
    turnTag: string,
    probe: TurnProbe,
    systemPrompt: string,
    messages: Message[]
): Promise<void> {
    const origExec = executeTool.executeToolCalls.bind(executeTool);
    const spy = jest
        .spyOn(executeTool, 'executeToolCalls')
        .mockImplementation(async (calls, opts) => {
            for (const c of calls) {
                probe.toolCalls.push({ name: c.name, args: c.arguments });
            }
            const results = await origExec(calls, opts);
            for (const r of results) {
                probe.toolResults.push({
                    name: r.name,
                    isError: Boolean(r.isError),
                    preview: r.content.slice(0, 160),
                    full: r.content,
                });
            }
            return results;
        });

    try {
        const agent = await runAgentTurnWithTools({
            systemPrompt,
            messages,
            model: process.env.EXPO_PUBLIC_NANO_GPT_MODEL,
            generation: { temperature: 0.4, maxTokens: 1_024 },
        });
        probe.reply = agent.content;
        probe.usedTools = agent.usedTools;
        probe.rounds = agent.rounds;
        probe.toolCallSource = agent.toolCallSource;
        probe.stopReason = agent.stopReason;
    } finally {
        spy.mockRestore();
    }

     
    console.log(
        `[multi-turn] ${turnTag} rounds=${probe.rounds} source=${probe.toolCallSource} `
        + `stop=${probe.stopReason ?? 'complete'}\n`
        + `  calls: ${probe.toolCalls.map((c) => `${c.name}(${c.args.slice(0, 80)})`).join(' | ') || '(none)'}\n`
        + `  results: ${probe.toolResults.map((r) => `${r.name}${r.isError ? ' [ERR]' : ''}: ${r.preview}`).join(' | ') || '(none)'}\n`
        + `  reply: ${probe.reply.slice(0, 400)}`
    );
}

const RETRY_DELAYS_MS = [2_000, 5_000, 10_000];

async function retryForAssertion(label: string, attempt: () => Promise<void>): Promise<void> {
    let lastError: unknown;
    for (let i = 0; i < RETRY_DELAYS_MS.length + 1; i += 1) {
        try {
            await attempt();
            return;
        } catch (error) {
            lastError = error;
            if (i < RETRY_DELAYS_MS.length) {
                 
                console.log(`[multi-turn] ${label} attempt ${i + 1} failed; retrying.`);
                await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[i]));
            }
        }
    }
    throw lastError;
}

describeMaybe('integration: 3-turn tool-calling accuracy (RUN_INTEGRATION_TESTS=1)', () => {
    jest.setTimeout(600_000);

    const originalEnv = { ...process.env };
    let liveModel: string;

    beforeAll(() => {
        liveModel = applyLiveEnv();
         
        console.log(`[multi-turn] provider=${process.env.EXPO_PUBLIC_NANO_GPT_API_BASE_URL} model=${liveModel} today=${getLocalDateKey()}`);
    });

    beforeEach(() => {
        setCustomModelStorageAdapter(memoryAdapter());
        setDayDigestStorageAdapter(memoryAdapter());
        setIdentityStorageAdapter(memoryAdapter());
        setStorageAdapter(memoryAdapter());
        mockedRecall.mockReset();
        mockedRecall.mockResolvedValue([
            {
                content: NEEDLE_MEMORY,
                similarity: 0.93,
                timestamp: Date.parse('2024-11-02T12:00:00'),
                documentId: 'journal_entry:seed-1',
            },
        ]);
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

    it('turn chain: yesterday grounding → exact words → long-term recall echo', async () => {
        // Account-bound ops (journal create) need an active account in test env.
        await activateAccount('live-tool-accuracy');
        const seed = yesterdayEntry();
        // Persist the REAL entry so get_conversation can load the transcript
        // (digest alone is not enough — get_conversation reads journal storage).
        // createEntry assigns its own id — capture it and build the digest from
        // the returned entry so digest source id === stored entry id.
        const entry: JournalEntry = await createEntry({
            title: seed.title,
            emoji: seed.emoji,
            messages: seed.messages,
            status: 'completed',
            analysis: seed.analysis,
            createdAt: seed.createdAt,
            updatedAt: seed.updatedAt,
        });
        await upsertJournalDayDigest(entry);
        const yesterday = getLocalDateKey(addLocalDays(new Date(), -1));
        const seededEntryId = entry.id;

        // Exact app weave for freeform chat: fresh digests block each turn, as
        // useChatOrchestration would rebuild it per send.
        const buildPrompt = async (): Promise<string> =>
            FLOWS.freeform.buildSystemPrompt({
                now: Date.now(),
                recentDaysContext: await buildRecentDaysContext({ days: 3 }),
            });

        const history: Message[] = [];

        // ---- Turn 1: yesterday grounding — must call get_day (or list then day),
        // ---- with the right resolved date, and echo seeded themes.
        const probe1: TurnProbe = {
            toolCalls: [],
            toolResults: [],
            reply: '',
            usedTools: false,
            rounds: 0,
            toolCallSource: 'none',
        };
        history.push({
            id: 'u1',
            role: 'user',
            content: 'What did I talk about yesterday? Be concrete about what happened.',
            timestamp: Date.now(),
        });

        await retryForAssertion('turn-1 get_day', async () => {
            probe1.toolCalls = [];
            probe1.toolResults = [];
            await runTurn('turn-1', probe1, await buildPrompt(), history);
            const dayCalls = probe1.toolCalls.filter(
                (c) => c.name === 'get_day' || c.name === 'list_recent_days'
            );
            expect(dayCalls.length).toBeGreaterThan(0);
            // Any explicit get_day args must resolve to yesterday — never an invented date.
            for (const call of probe1.toolCalls.filter((c) => c.name === 'get_day')) {
                const args = call.args.toLowerCase();
                if (args.includes('20')) {
                    expect(args).toContain(yesterday);
                }
            }
            expect(probe1.reply.trim().length).toBeGreaterThan(40);
            expect(probe1.reply.toLowerCase()).toMatch(/sleep|work|deck|slack|stress|boss/);
            expect(probe1.reply.toLowerCase()).not.toMatch(/i (don'?t|do not) (have|know) .*(record|memory|history)/);
            expect(probe1.reply).not.toMatch(/\bget_day\b|\blist_recent_days\b|\btool_call\b/);
        });
        history.push({
            id: 'a1',
            role: 'assistant',
            content: probe1.reply,
            timestamp: Date.now() + 1,
        });

        // ---- Turn 2: exact words — must chain get_conversation (id from digest)
        // ---- and quote real journal words ("deck three times" / "boss").
        const probe2: TurnProbe = {
            toolCalls: [],
            toolResults: [],
            reply: '',
            usedTools: false,
            rounds: 0,
            toolCallSource: 'none',
        };
        history.push({
            id: 'u2',
            role: 'user',
            content:
                'Pull up the exact words from that session — what did I literally say about my boss?',
            timestamp: Date.now() + 2,
        });

        await retryForAssertion('turn-2 get_conversation', async () => {
            probe2.toolCalls = [];
            probe2.toolResults = [];
            await runTurn('turn-2', probe2, await buildPrompt(), history);
            const conv = probe2.toolCalls.filter((c) => c.name === 'get_conversation');
            expect(conv.length).toBeGreaterThan(0);
            // The id must come from the seeded digest — never invented.
            const usedSeededId = conv.some((c) => c.args.includes(seededEntryId));
            const resolvedByDateOrTitle = conv.some((c) => /date|titleQuery/i.test(c.args));
            expect(usedSeededId || resolvedByDateOrTitle).toBe(true);
            const resultsOk = probe2.toolResults.some(
                (r) => r.name === 'get_conversation' && !r.isError && r.full.toLowerCase().includes('boss')
            );
            expect(resultsOk).toBe(true);
            expect(probe2.reply.toLowerCase()).toMatch(/boss|requirements|deck/);
            expect(probe2.reply).not.toMatch(/\bget_conversation\b|\btool_call\b/);
        });
        history.push({
            id: 'a2',
            role: 'assistant',
            content: probe2.reply,
            timestamp: Date.now() + 3,
        });

        // ---- Turn 3: long-term recall — must call recall_memory and echo needle.
        const probe3: TurnProbe = {
            toolCalls: [],
            toolResults: [],
            reply: '',
            usedTools: false,
            rounds: 0,
            toolCallSource: 'none',
        };
        history.push({
            id: 'u3',
            role: 'user',
            content:
                'Remember when I first started journaling here? What older memories keep echoing for you?',
            timestamp: Date.now() + 4,
        });

        await retryForAssertion('turn-3 recall_memory', async () => {
            probe3.toolCalls = [];
            probe3.toolResults = [];
            await runTurn('turn-3', probe3, await buildPrompt(), history);
            const recalls = probe3.toolCalls.filter((c) => c.name === 'recall_memory');
            expect(recalls.length).toBeGreaterThan(0);
            expect(mockedRecall.mock.calls.length).toBeGreaterThan(0);
            const needleDelivered = probe3.toolResults.some(
                (r) => r.name === 'recall_memory' && !r.isError && r.full.includes('teapot')
            );
            expect(needleDelivered).toBe(true);
            expect(probe3.reply.toLowerCase()).toMatch(/teapot|lisbon|grandmother/);
            expect(probe3.reply).not.toMatch(/\brecall_memory\b|\btool_call\b/);
        });

         
        console.log(
            '[multi-turn] TRANSCRIPT\n'
            + history.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')
        );
    }, 600_000);
});
