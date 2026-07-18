import {
    executeToolCall,
    getClockTool,
    getDayTool,
    listRecentDaysTool,
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
