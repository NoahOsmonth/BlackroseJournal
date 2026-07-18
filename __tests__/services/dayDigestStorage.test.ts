import type { JournalEntry } from '../../services/journal/journalStorage.types';
import type { IntentionCheckIn } from '../../services/intentions/intentionsStorage.types';
import {
    buildRecentDaysContext,
    clearDayDigests,
    getDayDigest,
    listDayDigests,
    resetDayDigestStorageAdapter,
    setDayDigestStorageAdapter,
    upsertCheckInDayDigest,
    upsertJournalDayDigest,
} from '../../services/memory/dayDigestStorage';

function createMemoryAdapter() {
    const store = new Map<string, string>();
    return {
        store,
        getItem: jest.fn(async (key: string) => store.get(key) ?? null),
        setItem: jest.fn(async (key: string, value: string) => {
            store.set(key, value);
        }),
        removeItem: jest.fn(async (key: string) => {
            store.delete(key);
        }),
    };
}

function journal(overrides: Partial<JournalEntry> = {}): JournalEntry {
    const createdAt = overrides.createdAt ?? new Date(2026, 6, 12, 10, 0, 0).getTime();
    return {
        id: 'entry-1',
        title: 'Work stress',
        emoji: '😓',
        messages: [
            { id: 'm1', role: 'user', content: 'I felt overwhelmed at work.', timestamp: createdAt },
            { id: 'm2', role: 'assistant', content: 'Tell me more.', timestamp: createdAt + 1 },
        ],
        status: 'completed',
        analysis: {
            insight: 'Career pressure is high.',
            quote: 'overwhelmed',
            mood: 'stressed',
            topics: ['Career', 'Stress'],
            generatedAt: createdAt,
        },
        createdAt,
        updatedAt: createdAt,
        ...overrides,
    };
}

function checkIn(overrides: Partial<IntentionCheckIn> = {}): IntentionCheckIn {
    const createdAt = overrides.createdAt ?? new Date(2026, 6, 12, 20, 0, 0).getTime();
    return {
        id: 'ci-1',
        intentionId: 'int-1',
        type: 'evening',
        title: 'Evening wind-down',
        summary: 'Grateful for a short walk.',
        status: 'completed',
        messages: [
            { id: 'c1', role: 'user', content: 'Grateful for a short walk.', timestamp: createdAt },
        ],
        createdAt,
        updatedAt: createdAt,
        ...overrides,
    };
}

describe('dayDigestStorage', () => {
    beforeEach(() => {
        setDayDigestStorageAdapter(createMemoryAdapter());
    });

    afterEach(async () => {
        await clearDayDigests();
        resetDayDigestStorageAdapter();
    });

    it('creates a day digest from a completed journal entry', async () => {
        const digest = await upsertJournalDayDigest(journal());
        expect(digest?.dateKey).toBe('2026-07-12');
        expect(digest?.topics).toEqual(expect.arrayContaining(['Career', 'Stress']));
        expect(digest?.sources[0]?.id).toBe('entry-1');
        expect(digest?.summary).toContain('Work stress');

        const loaded = await getDayDigest('2026-07-12');
        expect(loaded?.entryCount).toBe(1);
    });

    it('merges journal + check-in on the same day', async () => {
        await upsertJournalDayDigest(journal());
        const merged = await upsertCheckInDayDigest(checkIn());
        expect(merged?.entryCount).toBe(2);
        expect(merged?.sources.map((s) => s.kind).sort()).toEqual([
            'intention_checkin',
            'journal_entry',
        ]);
    });

    it('ignores drafts', async () => {
        await expect(upsertJournalDayDigest(journal({ status: 'draft' }))).resolves.toBeNull();
        await expect(listDayDigests()).resolves.toEqual([]);
    });

    it('builds recent days context markdown with write-day framing', async () => {
        await upsertJournalDayDigest(journal());
        const ctx = await buildRecentDaysContext({ days: 3 });
        expect(ctx).toContain('## Recent day digests');
        expect(ctx).toContain('Written 2026-07-12');
        // Sabotage: drop "Written " prefix in buildRecentDaysContext → red
    });

    it('tolerates corrupt storage payloads', async () => {
        const adapter = createMemoryAdapter();
        adapter.store.set('@blackrose_day_digests', '{not json');
        setDayDigestStorageAdapter(adapter);
        await expect(listDayDigests()).resolves.toEqual([]);
    });
});
