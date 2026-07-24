/**
 * PR8c live: list_recent_days order=oldest + search→get regression.
 *
 *   set PROBE_LLM=1
 *   npx jest --runInBand __tests__/integration/pr8cListRecentDaysLive.test.ts --forceExit
 *
 * Model: tencent/hy3:free (or EXPO_PUBLIC_NANO_GPT_MODEL). First take; attempt count logged.
 */

import fs from 'fs';
import path from 'path';

import { FLOWS } from '../../features/chat/flows';
import {
    MAX_AGENT_TOOL_ROUNDS,
    runAgentTurnWithTools,
} from '../../services/ai/agentLoop';
import * as executeTool from '../../services/ai/tools/executeTool';
import {
    resetCustomModelStorageAdapter,
    setCustomModelStorageAdapter,
} from '../../services/ai/customModels';
import {
    clearDayDigests,
    listDayDigests,
    resetDayDigestStorageAdapter,
    setDayDigestStorageAdapter,
    upsertJournalDayDigest,
} from '../../services/memory/dayDigestStorage';
import {
    clearAllEntries,
    resetStorageAdapter as resetJournalStorageAdapter,
    setStorageAdapter as setJournalStorageAdapter,
} from '../../services/journal/journalStorage';
import type { JournalEntry } from '../../services/journal/journalStorage.types';
import {
    clearMemoryAtoms,
    resetMemoryStorageAdapter,
    setMemoryStorageAdapter,
    upsertMemoryAtom,
} from '../../services/memory/localMemory';
import { buildClockContext } from '../../utils/date';
import { HISTORY_TOOLS_POLICY } from '../../services/ai/tools';
import {
    buildProbeFixture,
    SEMANTIC_NEEDLE_TOKEN,
} from '../../probes/shared/fixture';
import type { Message } from '../../services/ai/chatTypes';

const describeMaybe = process.env.PROBE_LLM === '1' ? describe : describe.skip;

function memoryAdapter() {
    const store = new Map<string, string>();
    return {
        getItem: jest.fn(async (key: string) => store.get(key) ?? null),
        setItem: jest.fn(async (key: string, value: string) => {
            store.set(key, value);
        }),
        removeItem: jest.fn(async (key: string) => {
            store.delete(key);
        }),
    };
}

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
        throw new Error('Missing EXPO_PUBLIC_NANO_GPT_API_KEY for PR8c live test.');
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

function entryFromFixture(
    id: string,
    dateISO: string,
    title: string,
    body: string,
    topics: string[],
    options?: { preferNeedleInInsight?: boolean }
): JournalEntry {
    const [y, m, d] = dateISO.split('-').map(Number);
    const createdAt = new Date(y, m - 1, d, 12, 0, 0).getTime();
    // Digests store analysis.insight as summary — keep needle tokens searchable.
    const insight = options?.preferNeedleInInsight
        ? body.slice(0, 500)
        : body.slice(0, 160);
    return {
        id,
        title,
        emoji: '📝',
        messages: [
            { id: `${id}-u`, role: 'user', content: body, timestamp: createdAt },
            {
                id: `${id}-a`,
                role: 'assistant',
                content: 'Thanks for sharing that.',
                timestamp: createdAt + 1,
            },
        ],
        status: 'completed',
        analysis: {
            insight,
            quote: body.slice(0, 40),
            mood: 'reflective',
            topics,
            generatedAt: createdAt,
        },
        createdAt,
        updatedAt: createdAt,
    };
}

describeMaybe('PR8c live list_recent_days + search regression (PROBE_LLM=1)', () => {
    let model = 'tencent/hy3:free';
    let fixture: ReturnType<typeof buildProbeFixture>;

    beforeAll(async () => {
        const env = applyLiveEnv();
        model = env.model;
        fixture = buildProbeFixture();

        const journalAdapter = memoryAdapter();
        setCustomModelStorageAdapter(memoryAdapter());
        setDayDigestStorageAdapter(memoryAdapter());
        setJournalStorageAdapter(journalAdapter);
        setMemoryStorageAdapter(memoryAdapter());

        // Seed all 365 fixture entries as completed journals + digests.
        const map: Record<string, JournalEntry> = {};
        let semantic: (typeof fixture.entries)[number] | undefined;
        for (const e of fixture.entries) {
            if (e.isSemanticNeedle) semantic = e;
            const entry = entryFromFixture(
                e.id,
                e.dateISO,
                e.title,
                e.body,
                e.isSemanticNeedle
                    ? [e.topic, 'fountain-pen', 'zephyr', SEMANTIC_NEEDLE_TOKEN]
                    : [e.topic],
                { preferNeedleInInsight: e.isSemanticNeedle }
            );
            map[entry.id] = entry;
            await upsertJournalDayDigest(entry);
        }
        await journalAdapter.setItem('@journal_entries', JSON.stringify(map));

        // Capsule atom so search_history finds the mid-history needle (digest list is newest-60).
        if (semantic) {
            await upsertMemoryAtom({
                layer: 'episodic',
                source: 'journal',
                sourceId: semantic.id,
                rootSourceId: semantic.id,
                rootSourceKind: 'journal_entry',
                title: 'Fountain pen catalog code',
                content:
                    `Cataloged rare fountain pen with private mnemonic ${SEMANTIC_NEEDLE_TOKEN}. `
                    + 'Quill-etched cap with zephyr-blue enamel. Written while sorting vintage pens.',
                salience: 9,
                tags: ['fountain-pen', 'zephyr', SEMANTIC_NEEDLE_TOKEN],
            });
        }

        const digests = await listDayDigests({ limit: 400 });
        // eslint-disable-next-line no-console
        console.log(
            `[pr8c-live] seeded digests=${digests.length} model=${model} `
            + `oldest=${fixture.entries[0]?.dateISO} title=${fixture.entries[0]?.title} `
            + `semantic=${semantic?.dateISO}`
        );
    }, 120_000);

    afterAll(async () => {
        await clearDayDigests();
        await clearAllEntries();
        await clearMemoryAtoms();
        resetDayDigestStorageAdapter();
        resetJournalStorageAdapter();
        resetMemoryStorageAdapter();
        resetCustomModelStorageAdapter();
    });

    it('oldest-of-365 needle retrieved within MAX_AGENT_TOOL_ROUNDS (first take)', async () => {
        const attemptCount = 1;
        const listOnly = fixture.entries.find((e) => e.isListOnlyNeedle)!;
        const clock = buildClockContext(new Date(`${fixture.referenceDateISO}T12:00:00`));
        const systemPrompt = FLOWS.freeform.buildSystemPrompt({
            clockContext: clock,
        });

        const question =
            "What was my very first journal entry? Quote the title and opening lines. "
            + "Use list_recent_days with order=oldest if needed.";

        const messages: Message[] = [
            { id: 'u1', role: 'user', content: question, timestamp: Date.now() },
        ];

        // eslint-disable-next-line no-console
        console.log(`[pr8c-live] Q_oldest attempt=${attemptCount} maxRounds=${MAX_AGENT_TOOL_ROUNDS}`);

        const toolLog: string[] = [];
        const origExec = executeTool.executeToolCalls.bind(executeTool);
        const spy = jest.spyOn(executeTool, 'executeToolCalls').mockImplementation(async (calls) => {
            for (const c of calls) {
                toolLog.push(`TOOL_CALL name=${c.name} args=${c.arguments}`);
            }
            const results = await origExec(calls);
            for (const r of results) {
                toolLog.push(
                    `TOOL_RESULT name=${r.name} isError=${Boolean(r.isError)} preview=${r.content.slice(0, 600)}`
                );
            }
            return results;
        });

        let agent;
        try {
            agent = await runAgentTurnWithTools({
                systemPrompt,
                messages,
                model,
                generation: { temperature: 0.2, maxTokens: 1_024 },
                maxRounds: MAX_AGENT_TOOL_ROUNDS,
            });
        } finally {
            spy.mockRestore();
        }

        const transcript = [
            `MODEL: ${model}`,
            `ATTEMPT: ${attemptCount} (first take)`,
            `HARNESS: PROBE_LLM=1 jest __tests__/integration/pr8cListRecentDaysLive.test.ts`,
            `QUESTION: ${question}`,
            `TARGET: ${listOnly.title} / ${listOnly.dateISO}`,
            `ROUNDS: ${agent.rounds}`,
            `USED_TOOLS: ${agent.usedTools}`,
            `STOP: ${agent.stopReason}`,
            `USAGE: ${JSON.stringify(agent.usage ?? null)}`,
            `CUMULATIVE_PROMPT_TOKENS: ${agent.cumulativePromptTokens}`,
            '--- TOOL_TRACE ---',
            ...toolLog,
            '--- FINAL ---',
            agent.content,
        ].join('\n');

        // eslint-disable-next-line no-console
        console.log(`[pr8c-live] TRANSCRIPT_OLDEST\n${transcript}`);

        const lower = agent.content.toLowerCase();
        const hit =
            lower.includes(listOnly.title.toLowerCase())
            || lower.includes('starting out')
            || lower.includes('first day trying')
            || lower.includes(listOnly.dateISO)
            || lower.includes('nothing special to report');

        expect(agent.rounds).toBeLessThanOrEqual(MAX_AGENT_TOOL_ROUNDS);
        expect(hit).toBe(true);
    }, 180_000);

    it('zephyr-quill-8137 semantic needle still found via search→get (regression)', async () => {
        const attemptCount = 1;
        const clock = buildClockContext(new Date(`${fixture.referenceDateISO}T12:00:00`));
        const systemPrompt = FLOWS.freeform.buildSystemPrompt({
            clockContext: clock,
        });

        const question =
            'I cataloged a rare fountain pen with a private code that looked like zephyr-something. '
            + 'What was that exact catalog token and what did I write about it?';

        const messages: Message[] = [
            { id: 'u2', role: 'user', content: question, timestamp: Date.now() },
        ];

        const toolLog: string[] = [];
        const origExec = executeTool.executeToolCalls.bind(executeTool);
        const spy = jest.spyOn(executeTool, 'executeToolCalls').mockImplementation(async (calls) => {
            for (const c of calls) {
                toolLog.push(`TOOL_CALL name=${c.name} args=${c.arguments}`);
            }
            const results = await origExec(calls);
            for (const r of results) {
                toolLog.push(
                    `TOOL_RESULT name=${r.name} isError=${Boolean(r.isError)} preview=${r.content.slice(0, 600)}`
                );
            }
            return results;
        });

        let agent;
        try {
            agent = await runAgentTurnWithTools({
                systemPrompt,
                messages,
                model,
                generation: { temperature: 0.2, maxTokens: 1_024 },
                maxRounds: MAX_AGENT_TOOL_ROUNDS,
            });
        } finally {
            spy.mockRestore();
        }

        const transcript = [
            `MODEL: ${model}`,
            `ATTEMPT: ${attemptCount} (first take)`,
            `HARNESS: PROBE_LLM=1 jest __tests__/integration/pr8cListRecentDaysLive.test.ts`,
            `QUESTION: ${question}`,
            `TARGET: ${SEMANTIC_NEEDLE_TOKEN}`,
            `ROUNDS: ${agent.rounds}`,
            `USED_TOOLS: ${agent.usedTools}`,
            `STOP: ${agent.stopReason}`,
            `USAGE: ${JSON.stringify(agent.usage ?? null)}`,
            `CUMULATIVE_PROMPT_TOKENS: ${agent.cumulativePromptTokens}`,
            '--- TOOL_TRACE ---',
            ...toolLog,
            '--- FINAL ---',
            agent.content,
        ].join('\n');

        // eslint-disable-next-line no-console
        console.log(`[pr8c-live] TRANSCRIPT_ZEPHYR\n${transcript}`);
        // Ensure policy still present for tools
        expect(HISTORY_TOOLS_POLICY.length).toBeGreaterThan(40);

        expect(agent.content.toLowerCase()).toContain(SEMANTIC_NEEDLE_TOKEN.toLowerCase());
    }, 180_000);
});
