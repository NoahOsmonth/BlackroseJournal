/**
 * Hindsight end-to-end smoke (live): retain a journal entry with a planted
 * needle, recall it, run a real chat turn against the free model, assert the
 * reply uses the memory. RUN_INTEGRATION_TESTS=1.
 *
 * Mirrors __tests__/integration/rosebudHistoryLive.test.ts conventions:
 * AsyncStorage custom adapter (no dynamic import in Jest), key source (.env),
 * streamChat call shape. Hindsight base URL is set in-test only — .env keeps
 * EXPO_PUBLIC_HINDSIGHT_BASE_URL unset (client defaults to disabled).
 */
import fs from 'fs';
import path from 'path';

import { THERAPIST_SYSTEM_PROMPT } from '../../constants/aiPrompts';
import { streamChat } from '../../services/ai';
import {
    resetCustomModelStorageAdapter,
    setCustomModelStorageAdapter,
} from '../../services/ai/customModels';
import {
    resetDayDigestStorageAdapter,
    setDayDigestStorageAdapter,
} from '../../services/memory/dayDigestStorage';
import { hindsightRetain } from '../../services/memory/hindsight/hindsightClient';
import { buildHindsightRecallContext } from '../../services/memory/hindsight/hindsightRecall';
import { buildRetainItemsFromJournalEntry } from '../../services/memory/hindsight/hindsightRetain';
import type { JournalEntry } from '../../services/journal/journalStorage.types';
import { getLocalDateKey } from '../../utils/date';

// Skipped unless RUN_INTEGRATION_TESTS=1: hits the real local Hindsight
// container + real OpenRouter free model. Unit suites cover the client and
// block builder offline.
const describeMaybe = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

const NEEDLE = 'lilac scarf from Grandma';

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
        throw new Error('Missing EXPO_PUBLIC_NANO_GPT_API_KEY for live Hindsight smoke test.');
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

function fixtureEntry(): JournalEntry {
    const ts = Date.now();
    return {
        id: `smoke_${ts}`,
        title: 'Grandma\u2019s gift',
        emoji: '\u{1F9E3}',
        messages: [
            {
                id: 'u1',
                role: 'user',
                content: `I got a ${NEEDLE}. She knitted it herself and it smells like her house.`,
                timestamp: ts,
                authoredTimezone: null,
                localDate: null,
                temporalProvenance: 'captured',
            },
        ],
        status: 'completed',
        createdAt: ts,
        updatedAt: ts,
    };
}

describeMaybe('integration: Hindsight retain → recall → assistant reply (live)', () => {
    jest.setTimeout(120_000);

    const originalEnv = { ...process.env };
    let liveMeta: { model: string; apiBaseUrl: string };

    beforeAll(() => {
        liveMeta = applyLiveEnv();
        console.log(
            `[live] provider=${liveMeta.apiBaseUrl} model=${liveMeta.model} today=${getLocalDateKey()}`
        );
    });

    beforeEach(() => {
        // Inject storage so directTransport never dynamic-imports AsyncStorage in Jest.
        setCustomModelStorageAdapter(memoryAdapter());
        setDayDigestStorageAdapter(memoryAdapter());
    });

    afterEach(() => {
        resetDayDigestStorageAdapter();
        resetCustomModelStorageAdapter();
    });

    afterAll(() => {
        process.env = { ...originalEnv };
    });

    it('retain → recall → reply references the needle', async () => {
        // EXPO_PUBLIC_HINDSIGHT_BASE_URL is deliberately NOT in .env; the live
        // test enables Hindsight in-place and restores (deletes) afterwards.
        process.env.EXPO_PUBLIC_HINDSIGHT_BASE_URL = 'http://localhost:8888';
        try {
            const bank = `smoke_${Date.now()}`;
            const entry = fixtureEntry();
            const items = buildRetainItemsFromJournalEntry(entry);

            // Container quirk (probed): the FIRST retain of a new document runs
            // a synchronous LLM extraction pass that can exceed the client's
            // fixed 6s retain timeout. Re-retaining the same document_id is an
            // idempotent fast upsert (~20ms, memory count stays 1). Bounded
            // retry keeps the plan's `retained === true` assertion while
            // tolerating free-model latency variance.
            let retained = false;
            for (let attempt = 1; attempt <= 5 && !retained; attempt += 1) {
                retained = await hindsightRetain(items, { bank });
                if (!retained) {
                    console.log(`[smoke] retain attempt ${attempt} timed out/failed — retrying`);
                    await new Promise((resolve) => setTimeout(resolve, 1500));
                }
            }
            expect(retained).toBe(true);

            const recallStarted = Date.now();
            const block = await buildHindsightRecallContext('What did I get from Grandma?', {
                bank,
                limit: 3,
            });
            const recallMs = Date.now() - recallStarted;
            console.log(
                `[smoke] hits=${(block ?? '').split('\n').filter((line) => line.startsWith('- sim=')).length}`
            );
            expect(block).toContain(NEEDLE);
            expect(recallMs).toBeLessThan(3000);

            let reply = '';
            const onError = jest.fn();
            const turnStarted = Date.now();
            const originalXhr = globalThis.XMLHttpRequest;
            delete (globalThis as { XMLHttpRequest?: typeof XMLHttpRequest }).XMLHttpRequest;

            try {
                await streamChat(
                    [
                        {
                            id: 'm1',
                            role: 'user',
                            content: 'Do you remember what I got from Grandma?',
                            timestamp: Date.now(),
                        },
                    ],
                    (chunk) => {
                        reply += chunk;
                    },
                    () => {
                        /* complete */
                    },
                    onError,
                    { systemPrompt: `${THERAPIST_SYSTEM_PROMPT}\n\n${block}` }
                );
            } finally {
                if (originalXhr) {
                    (globalThis as { XMLHttpRequest?: typeof XMLHttpRequest }).XMLHttpRequest =
                        originalXhr;
                }
            }
            const turnMs = Date.now() - turnStarted;

            if (onError.mock.calls.length) {
                console.warn('[smoke] stream error', onError.mock.calls[0]?.[0]);
            }
            expect(onError).not.toHaveBeenCalled();
            expect(reply.toLowerCase()).toContain('scarf');
            expect(turnMs).toBeLessThan(30_000);
            console.log(`[smoke] recallMs=${recallMs} turnMs=${turnMs} reply=${reply.slice(0, 200)}`);
        } finally {
            delete process.env.EXPO_PUBLIC_HINDSIGHT_BASE_URL;
        }
    }, 120_000);
});
