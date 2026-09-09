import {
    executeToolCall,
    getClockTool,
    getDayTool,
    listRecentDaysTool,
    HISTORY_TOOLS_POLICY,
} from '../../../services/ai/tools';
import {
    clearDayDigests,
    resetDayDigestStorageAdapter,
    setDayDigestStorageAdapter,
    upsertJournalDayDigest,
} from '../../../services/memory/dayDigestStorage';
import type { JournalEntry } from '../../../services/journal/journalStorage.types';
import { detectHistoryIntent } from '../../../services/ai/historyPrefetch';

function createMemoryAdapter() {
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

function journal(): JournalEntry {
    const createdAt = new Date(2026, 6, 12, 10, 0, 0).getTime();
    return {
        id: 'entry-hist-1',
        title: 'Sleep notes',
        emoji: '😴',
        messages: [
            { id: 'm1', role: 'user', content: 'I slept poorly.', timestamp: createdAt },
        ],
        status: 'completed',
        analysis: {
            insight: 'Sleep debt is building.',
            quote: 'poorly',
            mood: 'tired',
            topics: ['Sleep'],
            generatedAt: createdAt,
        },
        createdAt,
        updatedAt: createdAt,
    };
}

describe('history tools + intent detection', () => {
    beforeEach(() => {
        setDayDigestStorageAdapter(createMemoryAdapter());
    });

    afterEach(async () => {
        await clearDayDigests();
        resetDayDigestStorageAdapter();
    });

    it('detects temporal history questions', () => {
        expect(detectHistoryIntent('What did I talk about yesterday?')).toBe(true);
        expect(detectHistoryIntent('How are you feeling?')).toBe(false);
    });

    it('get_clock returns a clock block', async () => {
        const out = await getClockTool({});
        expect(out).toContain('## Clock');
        expect(out).toContain('Local date:');
    });

    it('list_recent_days and get_day read digests', async () => {
        await upsertJournalDayDigest(journal());
        const list = await listRecentDaysTool({ days: 3 });
        expect(list).toContain('Sleep notes');

        const day = await getDayTool({ date: '2026-07-12' });
        expect(day).toContain('writtenDate: 2026-07-12');
        expect(day).toContain('entry-hist-1');
    });

    it('PR8c: list_recent_days supports order oldest and from/to bounds', async () => {
        const older: JournalEntry = {
            ...journal(),
            id: 'entry-old',
            title: 'Oldest start',
            createdAt: new Date(2025, 0, 5, 10, 0, 0).getTime(),
            updatedAt: new Date(2025, 0, 5, 10, 0, 0).getTime(),
        };
        const mid: JournalEntry = {
            ...journal(),
            id: 'entry-mid',
            title: 'Mid era',
            createdAt: new Date(2025, 6, 1, 10, 0, 0).getTime(),
            updatedAt: new Date(2025, 6, 1, 10, 0, 0).getTime(),
        };
        const newest = journal(); // 2026-07-12
        await upsertJournalDayDigest(older);
        await upsertJournalDayDigest(mid);
        await upsertJournalDayDigest(newest);

        const oldestFirst = await listRecentDaysTool({ days: 2, order: 'oldest' });
        const firstBlock = oldestFirst.split('\n\n---\n\n')[0] ?? '';
        expect(firstBlock).toContain('writtenDate: 2025-01-05');
        expect(firstBlock).toContain('Oldest start');

        const ranged = await listRecentDaysTool({
            days: 10,
            order: 'oldest',
            from: '2025-06-01',
            to: '2025-12-31',
        });
        expect(ranged).toContain('Mid era');
        expect(ranged).not.toContain('Oldest start');
        expect(ranged).not.toContain('Sleep notes');

        // Default remains newest-first.
        const newestFirst = await listRecentDaysTool({ days: 1 });
        expect(newestFirst).toContain('Sleep notes');
    });

    it('executeToolCall validates unknown tools', async () => {
        const result = await executeToolCall({
            id: 'c1',
            name: 'not_a_real_tool',
            arguments: '{}',
        });
        expect(result.isError).toBe(true);
        expect(result.content).toContain('unknown tool');
    });

    it('get_day rejects bad date strings', async () => {
        const out = await getDayTool({ date: 'not-a-date' });
        expect(out).toContain('Error');
    });
});

describe('HISTORY_TOOLS_POLICY — tool-only long-term recall', () => {
    // Long-term recall is no longer injected automatically: the send path never
    // awaits Hindsight, so the curiosity nudge is the only recall driver for
    // free models that are lazy about tools.
    it('keeps the recall_memory curiosity nudge load-bearing', () => {
        expect(HISTORY_TOOLS_POLICY).toContain('recall_memory');
        expect(HISTORY_TOOLS_POLICY).toContain('be curious about it');
        expect(HISTORY_TOOLS_POLICY).toContain('"remember when\u2026"');
        expect(HISTORY_TOOLS_POLICY).toContain('one call costs nothing');
    });

    it('stays within the prompt budget', () => {
        expect(HISTORY_TOOLS_POLICY.length).toBeLessThan(900);
    });
});
