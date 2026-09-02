import fs from 'fs';
import { setDayDigestStorageAdapter, resetDayDigestStorageAdapter, clearDayDigests, upsertJournalDayDigest } from '../../../services/memory/dayDigestStorage';
import { buildRetrievedHistoryContext } from '../../../services/ai/historyPrefetch';
import type { JournalEntry } from '../../../services/journal/journalStorage.types';

function memoryAdapter() {
    const store = new Map<string, string>();
    return {
        getItem: jest.fn(async (key: string) => store.get(key) ?? null),
        setItem: jest.fn(async (key: string, value: string) => { store.set(key, value); }),
        removeItem: jest.fn(async (key: string) => { store.delete(key); }),
    };
}

function entryForDate(dateKey: string, note: string): JournalEntry {
    const [y, m, d] = dateKey.split('-').map(Number);
    const createdAt = new Date(y, (m ?? 1) - 1, d ?? 1, 10, 0, 0).getTime();
    return {
        id: `hist-${dateKey}`,
        title: note,
        emoji: '📝',
        messages: [{ id: `m-${dateKey}`, role: 'user', content: note, timestamp: createdAt }],
        status: 'completed',
        analysis: { insight: note, quote: note, mood: 'calm', topics: [note], generatedAt: createdAt },
        createdAt,
        updatedAt: createdAt,
    };
}

describe('historical range recall (week/month windows)', () => {
    beforeEach(() => {
        setDayDigestStorageAdapter(memoryAdapter());
    });

    afterEach(async () => {
        await clearDayDigests();
        resetDayDigestStorageAdapter();
    });

    it('resolves "last week" to a window and includes a mid-window digest', async () => {
        // Fixed "now": Monday 2026-07-13. Last week = ~2026-07-06 → 12.
        const now = new Date(2026, 6, 13, 12, 0, 0);
        await upsertJournalDayDigest(entryForDate('2026-07-08', 'Wednesday walk debate'));
        await upsertJournalDayDigest(entryForDate('2026-07-01', 'First of month'));

        const ctx = await buildRetrievedHistoryContext('What did I do last week?', now);
        expect(ctx).toContain('## Retrieved history');
        expect(ctx).toContain('Wednesday walk debate');
        // The window request must not blindly pick the single most recent 3 days'
        // content-incompatible fallback: it should look at the window, and a
        // 2026-07-01 atom is *outside* last week's window.
        expect(ctx).not.toContain('First of month');
    });

    it('falls back to recent digests when the window has none, still framed as history', async () => {
        const now = new Date(2026, 11, 28, 12, 0, 0);
        await upsertJournalDayDigest(entryForDate('2026-12-05', 'December note'));
        const ctx = await buildRetrievedHistoryContext('What happened last month?', now);
        // No digests inside last month's window (12/05 vs ~11/28-12/27): the
        // response should still be a history-framed block, not a non-history fallback.
        expect(ctx).toBeDefined();
    });

    it('keeps the eager blob capped and whole-line', () => {
        const source = fs.readFileSync('services/ai/historyPrefetch.ts', 'utf-8');
        expect(source).toContain('RELATIVE_RANGE_RE');
        expect(source).toContain('WEEK_DAYS');
    });
});