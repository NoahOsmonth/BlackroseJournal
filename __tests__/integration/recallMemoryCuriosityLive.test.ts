/* eslint-disable import/first */

/**
 * Live integration: tool-only long-term recall — does the model call
 * `recall_memory` when the prompt offers no injected recall block?
 *
 * The send path no longer awaits Hindsight and no reactive recall context is
 * injected, so the HISTORY_TOOLS_POLICY curiosity nudge is the only recall
 * driver. This probe runs the REAL agent loop (real provider, real prompt
 * weave, real tool schema/validate/execute pipeline) with the Hindsight client
 * stubbed at the module boundary, and asserts the model spontaneously calls
 * recall_memory on a "remember when…" probe.
 *
 * Run (PowerShell):
 *   $env:RUN_INTEGRATION_TESTS='1'
 *   npx jest --runInBand __tests__/integration/recallMemoryCuriosityLive.test.ts --forceExit
 */

import fs from 'fs';
import path from 'path';

import { FLOWS } from '../../features/chat/flows';
import { runAgentTurnWithTools } from '../../services/ai/agentLoop';
import * as executeTool from '../../services/ai/tools/executeTool';
import {
    resetCustomModelStorageAdapter,
    setCustomModelStorageAdapter,
} from '../../services/ai/customModels';
import type { Message } from '../../services/ai/chatTypes';

jest.mock('../../services/memory/hindsight/hindsightClient', () => ({
    hindsightRecall: jest.fn(),
    subscribeHindsightChanges: jest.fn(() => () => undefined),
    notifyHindsightChanged: jest.fn(),
}));
import { hindsightRecall } from '../../services/memory/hindsight/hindsightClient';

const mockedRecall = hindsightRecall as jest.MockedFunction<typeof hindsightRecall>;

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
        throw new Error('Missing EXPO_PUBLIC_NANO_GPT_API_KEY for live recall-curiosity probe.');
    }
    const apiBaseUrl = (
        process.env.EXPO_PUBLIC_NANO_GPT_API_BASE_URL
        ?? fileEnv.EXPO_PUBLIC_NANO_GPT_API_BASE_URL
        ?? 'http://100.107.7.52:20128/v1'
    ).replace(/\/+$/, '');
    const model =
        process.env.EXPO_PUBLIC_NANO_GPT_MODEL
        ?? fileEnv.EXPO_PUBLIC_NANO_GPT_MODEL
        ?? 'cl/dots-studio/dots-3-note-preview:free';

    process.env.EXPO_PUBLIC_NANO_GPT_API_KEY = apiKey;
    process.env.EXPO_PUBLIC_NANO_GPT_API_BASE_URL = apiBaseUrl;
    process.env.EXPO_PUBLIC_NANO_GPT_MODEL = model;
    process.env.EXPO_PUBLIC_NANO_GPT_FLASH_MODEL = model;
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

/** Distinct needle the stubbed recall returns — proves the result reached the reply. */
const NEEDLE_MEMORY =
    'your grandfather\u2019s brass compass from the windowsill trip (Written 2024-11-02)';

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
                console.log(`[recall-live] ${label} attempt ${i + 1} failed; retrying.`);
                await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[i]));
            }
        }
    }
    throw lastError;
}

describeMaybe('integration: tool-only long-term recall curiosity (RUN_INTEGRATION_TESTS=1)', () => {
    jest.setTimeout(180_000);

    const originalEnv = { ...process.env };
    let liveMeta: { model: string; apiBaseUrl: string };

    beforeAll(() => {
        liveMeta = applyLiveEnv();
        console.log(`[recall-live] provider=${liveMeta.apiBaseUrl} model=${liveMeta.model}`);
    });

    beforeEach(() => {
        // Jest + AsyncStorage gotcha: keep directTransport from dynamic-importing it.
        setCustomModelStorageAdapter(memoryAdapter());
        mockedRecall.mockReset();
        // Seed the stub so a recall_memory call that does happen feeds the model
        // real content through the real handler → loop → reply pipeline.
        mockedRecall.mockResolvedValue([
            {
                content: NEEDLE_MEMORY,
                similarity: 0.92,
                timestamp: Date.parse('2024-11-02T12:00:00'),
                documentId: 'journal_entry:seed-1',
            },
        ]);
    });

    afterEach(() => {
        resetCustomModelStorageAdapter();
        process.env = { ...originalEnv };
    });

    it('model spontaneously calls recall_memory on a "remember when…" probe (no injected recall)', async () => {
        // Exact app prompt weave for a freeform chat with NO recall context —
        // the new policy line is the only mention of long-term memory.
        const systemPrompt = FLOWS.freeform.buildSystemPrompt({
            now: Date.now(),
            recentDaysContext: '## Recent day digests\n- (only the last few days are stored here)',
        });
        expect(systemPrompt).toContain('recall_memory');
        expect(systemPrompt).toContain('be curious about it');
        expect(systemPrompt).not.toContain('## Relevant long-term context');

        const messages: Message[] = [
            {
                id: 'u1',
                role: 'user',
                content: 'Remember when I first started journaling here? What keeps coming back over the months?',
                timestamp: Date.now(),
            },
        ];

        const toolLog: string[] = [];
        const origExec = executeTool.executeToolCalls.bind(executeTool);
        const spy = jest.spyOn(executeTool, 'executeToolCalls').mockImplementation(async (calls) => {
            for (const c of calls) {
                toolLog.push(`TOOL_CALL name=${c.name} args=${c.arguments}`);
            }
            const results = await origExec(calls);
            for (const r of results) {
                toolLog.push(`TOOL_RESULT name=${r.name} isError=${Boolean(r.isError)} preview=${r.content.slice(0, 200)}`);
            }
            return results;
        });

        // Free models vary per take (one run may search digests first and answer
        // from thin results). Repo convention for live probes: retry with fresh
        // attempts, never weaken the assertion itself (mirrors app-live-probe.js).
        await retryForAssertion('recall call', async () => {
            let agent: Awaited<ReturnType<typeof runAgentTurnWithTools>>;
            try {
                agent = await runAgentTurnWithTools({
                    systemPrompt,
                    messages,
                    model: liveMeta.model,
                    generation: { temperature: 0.4, maxTokens: 1_024 },
                });
            } finally {
                // keep the spy mounted across retries; restored below
            }
            console.log(`[recall-live] FINAL (attempt)\n${agent.content.slice(0, 600)}`);
            const calledRecall = toolLog.some((line) => line.startsWith('TOOL_CALL name=recall_memory'));
            expect(calledRecall).toBe(true);
            expect(agent.usedTools).toBe(true);
            expect(agent.content.trim().length).toBeGreaterThan(20);
        });

        spy.mockRestore();

        const transcript = [
            `MODEL: ${liveMeta.model}`,
            `HARNESS: RUN_INTEGRATION_TESTS=1 jest __tests__/integration/recallMemoryCuriosityLive.test.ts`,
            `PROMPT_HAS_NO_INJECTED_RECALL: ${!systemPrompt.includes('## Relevant long-term context')}`,
            '--- TOOL_TRACE (all attempts) ---',
            ...toolLog,
        ].join('\n');
        console.log(`[recall-live] TRANSCRIPT\n${transcript}`);
    }, 180_000);

    it('recalled content reaches the final reply (needle echo)', async () => {
        mockedRecall.mockResolvedValue([
            {
                content: NEEDLE_MEMORY,
                similarity: 0.92,
                timestamp: Date.parse('2024-11-02T12:00:00'),
                documentId: 'journal_entry:seed-1',
            },
        ]);

        const systemPrompt = FLOWS.freeform.buildSystemPrompt({ now: Date.now() });
        const messages: Message[] = [
            {
                id: 'u2',
                role: 'user',
                content: 'Remember when I first started journaling here? What keeps coming back over the months?',
                timestamp: Date.now(),
            },
        ];

        await retryForAssertion('needle echo', async () => {
            const agent = await runAgentTurnWithTools({
                systemPrompt,
                messages,
                model: liveMeta.model,
                generation: { temperature: 0.4, maxTokens: 1_024 },
            });
            console.log(`[recall-live] needle reply=\n${agent.content.slice(0, 600)}`);
            expect(agent.content.toLowerCase()).toMatch(/compass/);
            expect(agent.content.toLowerCase()).toMatch(/grandfather/);
        });
    }, 180_000);
});
