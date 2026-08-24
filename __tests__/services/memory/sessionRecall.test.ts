/* eslint-disable import/first */
/**
 * Phase 3 session recall triggers + ranking.
 *
 * What would make these fail?
 * - Firing on unrelated small talk (false positive)
 * - Missing "what did we talk about last month" (false negative)
 * - Requiring embeddings when offline (blocks date-only path)
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
    },
}));

import {
    buildSessionRecallContext,
    detectSessionRecallIntent,
    resolveSessionRecallDateRange,
} from '../../../services/memory/sessionRecall';
import {
    clearSessionDigests,
    resetSessionDigestStorageAdapter,
    setSessionDigestStorageAdapter,
    upsertSessionDigest,
} from '../../../services/memory/sessionDigestStorage';
import type { SessionDigest } from '../../../services/memory/sessionDigest.types';

function createInMemoryAdapter() {
    const store = new Map<string, string>();
    return {
        store,
        getItem: async (key: string) => store.get(key) ?? null,
        setItem: async (key: string, value: string) => {
            store.set(key, value);
        },
        removeItem: async (key: string) => {
            store.delete(key);
        },
        multiGet: async (keys: readonly string[]) =>
            keys.map((k) => [k, store.get(k) ?? null] as [string, string | null]),
        multiRemove: async (keys: readonly string[]) => {
            keys.forEach((k) => store.delete(k));
        },
        getAllKeys: async () => Array.from(store.keys()),
    };
}

function digest(partial: Partial<SessionDigest> & Pick<SessionDigest, 'sessionId' | 'dateISO' | 'oneLineSummary'>): SessionDigest {
    return {
        schemaVersion: 1,
        topics: partial.topics ?? ['general'],
        entryWordCount: partial.entryWordCount ?? 20,
        createdAt: partial.createdAt ?? Date.now(),
        sourceKind: partial.sourceKind ?? 'journal_entry',
        sourceId: partial.sourceId ?? partial.sessionId,
        ...partial,
    };
}

describe('sessionRecall', () => {
    beforeEach(() => {
        setSessionDigestStorageAdapter(createInMemoryAdapter());
    });

    afterEach(async () => {
        await clearSessionDigests();
        resetSessionDigestStorageAdapter();
    });

    it('fires on temporal recall and not on unrelated small talk', () => {
        expect(detectSessionRecallIntent('what did we talk about last month')).toBe(true);
        expect(detectSessionRecallIntent('What did we talk about last month?')).toBe(true);
        expect(detectSessionRecallIntent('did I mention my sister')).toBe(true);
        expect(detectSessionRecallIntent('last time I mentioned work')).toBe(true);

        // False-positive check
        expect(detectSessionRecallIntent('hi')).toBe(false);
        expect(detectSessionRecallIntent('I am tired today')).toBe(false);
        expect(detectSessionRecallIntent('how do I make pasta')).toBe(false);
    });

    it('resolves last month to a ~30 day window', () => {
        const now = new Date(2026, 6, 17); // July 17 2026 local
        const range = resolveSessionRecallDateRange('what did we talk about last month', now);
        expect(range?.label).toBe('last month');
        expect(range?.to).toBe('2026-07-17');
        expect(range?.from).toBe('2026-06-17');
    });

    it('injects matching digests for last month (date path)', async () => {
        const now = new Date(2026, 6, 17, 12, 0, 0);

        await upsertSessionDigest(digest({
            sessionId: 'in-range',
            dateISO: '2026-07-01',
            oneLineSummary: 'Talked about sister and family stress.',
            topics: ['family', 'sister'],
            createdAt: now.getTime() - 5 * 86_400_000,
        }));
        await upsertSessionDigest(digest({
            sessionId: 'out-of-range',
            dateISO: '2026-01-01',
            oneLineSummary: 'Ancient session about pasta recipes.',
            topics: ['food'],
            createdAt: now.getTime() - 200 * 86_400_000,
        }));

        const block = await buildSessionRecallContext(
            'what did we talk about last month',
            { now },
        );

        expect(block).toContain('## Relevant past context');
        expect(block).toContain('sister');
        expect(block).toContain('Written 2026-07-01');
        expect(block).not.toContain('pasta');

        // eslint-disable-next-line no-console
        console.log('[recall-diag] last month block:\n', block);
    });

    /**
     * Offline: embed fails → still return date-window digests.
     * What would make this fail: requiring non-empty embedding to include a row.
     */
    it('falls back to date-range-only recall without embeddings', async () => {
        const now = new Date(2026, 6, 17);
        await upsertSessionDigest(digest({
            sessionId: 'work1',
            dateISO: '2026-07-10',
            oneLineSummary: 'Deadlines at work felt crushing.',
            topics: ['work stress'],
            createdAt: now.getTime() - 3 * 86_400_000,
        }));

        const block = await buildSessionRecallContext(
            'what did we talk about last week',
            { now },
        );
        expect(block).toContain('Deadlines at work');
        expect(block).toContain('Date window');
    });

    /**
     * T6: stored eventDate surfaces as absolute Event label in recall lines.
     * Sabotage: drop eventDate formatting from formatRecallLine → red.
     */
    it('injects Event absolute date label when digest has eventDate', async () => {
        const now = new Date(2026, 6, 18, 16, 0, 0);

        await upsertSessionDigest(digest({
            sessionId: 'dentist-event',
            dateISO: '2026-07-18',
            oneLineSummary: 'User noted having a dentist appointment on Friday.',
            topics: ['dentist', 'appointment'],
            eventDate: '2026-07-24',
            createdAt: now.getTime(),
        }));

        expect(detectSessionRecallIntent('When is my dentist appointment?')).toBe(true);

        const block = await buildSessionRecallContext(
            'When is my dentist appointment?',
            { now },
        );

        expect(block).toContain('## Relevant past context');
        expect(block).toContain('Written 2026-07-18');
        expect(block).toContain('Event: 2026-07-24 (Fri)');
        expect(block).toContain('dentist');
    });

    it('ranks by keyword overlap when digests match the query', async () => {
        const now = new Date(2026, 6, 17);

        await upsertSessionDigest(digest({
            sessionId: 'work',
            dateISO: '2026-07-01',
            oneLineSummary: 'Work stress and deadlines.',
            topics: ['work'],
            createdAt: now.getTime() - 10 * 86_400_000,
        }));
        await upsertSessionDigest(digest({
            sessionId: 'food',
            dateISO: '2026-07-02',
            oneLineSummary: 'Cooked a tomato pasta recipe.',
            topics: ['food', 'pasta'],
            createdAt: now.getTime() - 9 * 86_400_000,
        }));

        const block = await buildSessionRecallContext(
            'last time I mentioned work pressure',
            { now },
        );
        expect(block).toContain('Work stress');
        // Food has no keyword overlap with the query — excluded by the gate.
        expect(block).not.toContain('pasta');
    });

    it('returns undefined (no inject) for non-recall messages even if digests exist', async () => {
        await upsertSessionDigest(digest({
            sessionId: 'x',
            dateISO: '2026-07-01',
            oneLineSummary: 'Anything',
        }));
        const block = await buildSessionRecallContext('I am tired today');
        expect(block).toBeUndefined();
    });
});
