/**
 * Live integration: real OpenRouter/model + Rosebud prompt + day digests + tools.
 *
 * Run:
 *   set RUN_INTEGRATION_TESTS=1
 *   npx jest --runInBand __tests__/integration/rosebudHistoryLive.test.ts --forceExit
 *
 * Reads EXPO_PUBLIC_NANO_GPT_* from process env or project .env (gitignored).
 */

import fs from 'fs';
import path from 'path';

import { THERAPIST_SYSTEM_PROMPT } from '../../constants/aiPrompts';
import { FLOWS, composeSystemPrompt } from '../../features/chat/flows';
import { completeChat, streamChat, type Message } from '../../services/ai';
import { runAgentTurnWithTools } from '../../services/ai/agentLoop';
import {
    compactConversationIfNeeded,
    estimatePromptTokens,
} from '../../services/ai/conversationCompact';
import {
    resetCustomModelStorageAdapter,
    setCustomModelStorageAdapter,
} from '../../services/ai/customModels';
import {
    clearDayDigests,
    resetDayDigestStorageAdapter,
    setDayDigestStorageAdapter,
    upsertJournalDayDigest,
} from '../../services/memory/dayDigestStorage';
import type { JournalEntry } from '../../services/journal/journalStorage.types';
import {
    addLocalDays,
    buildClockContext,
    getLocalDateKey,
} from '../../utils/date';
import { HISTORY_TOOLS_POLICY } from '../../services/ai/tools';
import { executeToolCall } from '../../services/ai/tools/executeTool';

// Skipped unless RUN_INTEGRATION_TESTS=1: hits a real OpenRouter/model with a live API key.
// Not a silent product gap — unit suites cover digests/tools/prompt weave offline.
// TODO(follow-up): keep offline. Do not un-skip in default CI without a secret + quota budget.
const describeMaybe = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

function readEnvFile(): Record<string, string> {
    const envPath = path.join(process.cwd(), '.env');
    const text = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
    return Object.fromEntries(
        text
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith('#'))
            .map((line) => {
                const index = line.indexOf('=');
                if (index < 0) return [line, ''];
                return [line.slice(0, index), line.slice(index + 1)];
            })
    );
}

function applyLiveEnv(): { model: string; apiBaseUrl: string } {
    const fileEnv = readEnvFile();
    const apiKey =
        process.env.EXPO_PUBLIC_NANO_GPT_API_KEY ?? fileEnv.EXPO_PUBLIC_NANO_GPT_API_KEY;
    if (!apiKey) {
        throw new Error('Missing EXPO_PUBLIC_NANO_GPT_API_KEY for live Rosebud test.');
    }
    const apiBaseUrl = (
        process.env.EXPO_PUBLIC_NANO_GPT_API_BASE_URL
        ?? fileEnv.EXPO_PUBLIC_NANO_GPT_API_BASE_URL
        ?? 'https://openrouter.ai/api/v1'
    ).replace(/\/+$/, '');
    const model =
        process.env.EXPO_PUBLIC_NANO_GPT_MODEL
        ?? fileEnv.EXPO_PUBLIC_NANO_GPT_MODEL
        ?? 'tencent/hy3:free';

    process.env.EXPO_PUBLIC_NANO_GPT_API_KEY = apiKey;
    process.env.EXPO_PUBLIC_NANO_GPT_API_BASE_URL = apiBaseUrl;
    process.env.EXPO_PUBLIC_NANO_GPT_MODEL = model;
    process.env.EXPO_PUBLIC_NANO_GPT_FLASH_MODEL =
        process.env.EXPO_PUBLIC_NANO_GPT_FLASH_MODEL
        ?? fileEnv.EXPO_PUBLIC_NANO_GPT_FLASH_MODEL
        ?? model;

    return { model, apiBaseUrl };
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

function journalYesterday(): JournalEntry {
    const createdAt = addLocalDays(new Date(), -1).getTime();
    return {
        id: 'live-entry-sleep',
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
        ],
        status: 'completed',
        analysis: {
            insight: 'Sleep debt is amplifying work stress.',
            quote: 'barely slept',
            mood: 'exhausted',
            topics: ['Sleep', 'Work', 'Stress'],
            generatedAt: createdAt,
        },
        createdAt,
        updatedAt: createdAt,
    };
}

function buildFreeformSystemPrompt(recentDaysContext?: string): string {
    const now = Date.now();
    return composeSystemPrompt(THERAPIST_SYSTEM_PROMPT, {
        now,
        clockContext: buildClockContext(new Date(now)),
        recentDaysContext,
        omitHistoryToolsPolicy: false,
    });
}

describeMaybe('integration: Rosebud prompt + history live', () => {
    jest.setTimeout(120_000);

    const originalEnv = { ...process.env };
    let liveMeta: { model: string; apiBaseUrl: string };

    beforeAll(() => {
        liveMeta = applyLiveEnv();
        // eslint-disable-next-line no-console
        console.log(
            `[live] provider=${liveMeta.apiBaseUrl} model=${liveMeta.model} today=${getLocalDateKey()}`
        );
    });

    beforeEach(() => {
        // Inject storage so directTransport never dynamic-imports AsyncStorage in Jest.
        setCustomModelStorageAdapter(memoryAdapter());
        setDayDigestStorageAdapter(memoryAdapter());
    });

    afterEach(async () => {
        await clearDayDigests();
        resetDayDigestStorageAdapter();
        resetCustomModelStorageAdapter();
    });

    afterAll(() => {
        process.env = { ...originalEnv };
    });

    it('provider is reachable with a tiny completion', async () => {
        const res = await fetch(`${liveMeta.apiBaseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${process.env.EXPO_PUBLIC_NANO_GPT_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: liveMeta.model,
                messages: [{ role: 'user', content: 'Reply with exactly: pong' }],
                stream: false,
                temperature: 0,
                max_tokens: 32,
            }),
        });
        const body = await res.text();
        expect(res.status).toBe(200);
        expect(body.toLowerCase()).toMatch(/pong|choices/);
    });

    it('local tools work on-device (get_clock + get_day after digest seed)', async () => {
        const entry = journalYesterday();
        await upsertJournalDayDigest(entry);
        const yesterday = getLocalDateKey(addLocalDays(new Date(), -1));

        const clock = await executeToolCall({
            id: 't1',
            name: 'get_clock',
            arguments: '{}',
        });
        expect(clock.isError).not.toBe(true);
        expect(clock.content).toContain('## Clock');
        expect(clock.content).toContain(getLocalDateKey());

        const day = await executeToolCall({
            id: 't2',
            name: 'get_day',
            arguments: JSON.stringify({ date: 'yesterday' }),
        });
        expect(day.isError).not.toBe(true);
        expect(day.content).toContain(yesterday);
        expect(day.content.toLowerCase()).toMatch(/sleep|work/);
    });

    it('answers "what did I talk about yesterday?" using digests + full Rosebud prompt', async () => {
        const entry = journalYesterday();
        await upsertJournalDayDigest(entry);
        const yesterday = getLocalDateKey(addLocalDays(new Date(), -1));

        const dayTool = await executeToolCall({
            id: 'pre',
            name: 'get_day',
            arguments: JSON.stringify({ date: 'yesterday' }),
        });

        const recentDaysContext = [
            '## Recent day digests',
            `- ${yesterday}: Sessions: Sleep debt and work pressure. Topics: Sleep, Work, Stress.`,
            '',
            '## Retrieved history',
            dayTool.content,
        ].join('\n');

        const systemPrompt = buildFreeformSystemPrompt(recentDaysContext);
        expect(systemPrompt.length).toBeGreaterThan(20_000);
        expect(systemPrompt).toContain('Rosebud');
        expect(systemPrompt).toContain(HISTORY_TOOLS_POLICY.slice(0, 40));

        const messages: Message[] = [
            {
                id: 'u-y',
                role: 'user',
                content: 'What did I talk about yesterday? Be concrete about themes from my journal.',
                timestamp: Date.now(),
            },
        ];

        // Prefer agent loop (tools); fall back to completeChat with prefetch context.
        let answer = '';
        let path = 'unknown';
        try {
            const agent = await runAgentTurnWithTools({
                systemPrompt,
                messages,
                generation: { temperature: 0.4, maxTokens: 900 },
            });
            answer = agent.content.trim();
            path = agent.usedTools ? 'agent+tools' : 'agent-no-tools';
        } catch (error) {
            // eslint-disable-next-line no-console
            console.warn('[live] agent loop failed, completeChat fallback:', error);
            const result = await completeChat(messages, systemPrompt, {
                generation: { temperature: 0.4, maxTokens: 900 },
            });
            answer = result.content.trim();
            path = 'completeChat-fallback';
        }

        // eslint-disable-next-line no-console
        console.log(`[live] yesterday path=${path} answer=\n${answer.slice(0, 800)}`);

        expect(answer.length).toBeGreaterThan(40);
        // Should ground in seeded themes somehow (sleep/work/stress/exhaustion)
        expect(answer.toLowerCase()).toMatch(/sleep|work|stress|exhaust|deck|slack|tired/);
        // Should not claim total amnesia when digests were provided
        expect(answer.toLowerCase()).not.toMatch(
            /i (have no|don't have any|do not have any) (memory|record|history|information)/
        );
    });

    it('streams a curious first reply to an evening-style rant with freeform prompt', async () => {
        const systemPrompt = buildFreeformSystemPrompt(
            '## Recent day digests\n- (none yet — brand new journal)'
        );
        const messages: Message[] = [
            {
                id: 'u-rant',
                role: 'user',
                content:
                    "I'm exhausted and work crushed me today. I keep replaying one meeting and I can't tell if I'm overreacting.",
                timestamp: Date.now(),
            },
        ];

        const onChunk = jest.fn();
        const onComplete = jest.fn();
        const onError = jest.fn();
        const originalXhr = globalThis.XMLHttpRequest;
        delete (globalThis as { XMLHttpRequest?: typeof XMLHttpRequest }).XMLHttpRequest;

        try {
            await streamChat(messages, onChunk, onComplete, onError, {
                systemPrompt,
                enableHistoryTools: true,
                generation: { temperature: 0.7, maxTokens: 700 },
            });
        } finally {
            if (originalXhr) {
                (globalThis as { XMLHttpRequest?: typeof XMLHttpRequest }).XMLHttpRequest =
                    originalXhr;
            }
        }

        if (onError.mock.calls.length) {
            // eslint-disable-next-line no-console
            console.warn('[live] stream error', onError.mock.calls[0]?.[0]);
        }
        expect(onError).not.toHaveBeenCalled();
        expect(onComplete).toHaveBeenCalled();
        const [content] = onComplete.mock.calls[0] as [string, string];
        // eslint-disable-next-line no-console
        console.log(`[live] rant reply=\n${content.slice(0, 800)}`);
        expect(content.trim().length).toBeGreaterThan(40);
        // Companion should sound engaged, not like a sterile form
        expect(content.toLowerCase()).not.toMatch(/as an ai language model/);
    });

    it('auto-compacts oversized threads under a free-model-sized window', () => {
        const systemPrompt = buildFreeformSystemPrompt();
        const messages: Message[] = [];
        for (let i = 0; i < 60; i += 1) {
            messages.push({
                id: `m${i}`,
                role: i % 2 === 0 ? 'user' : 'assistant',
                content: `Turn ${i}. ${'detail about sleep and work stress '.repeat(40)}`,
                timestamp: Date.now() + i,
            });
        }
        const before = estimatePromptTokens(systemPrompt, messages);
        const result = compactConversationIfNeeded(messages, {
            systemPrompt,
            contextWindow: 16_384,
            keepRecent: 6,
        });
        // eslint-disable-next-line no-console
        console.log(
            `[live] compact before=${before} after=${result.estimatedTokensAfter} compacted=${result.compacted}`
        );
        expect(result.compacted).toBe(true);
        expect(result.estimatedTokensAfter).toBeLessThan(before);
        expect(FLOWS.freeform.id).toBe('freeform');
    });
});
