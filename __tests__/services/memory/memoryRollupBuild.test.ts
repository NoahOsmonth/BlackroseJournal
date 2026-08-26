/* eslint-disable import/first */
/**
 * Lazy rollup build. Mocks network; exercises storage + thresholds.
 *
 * What would make this fail?
 * - Building rollups for the *current* (open) week
 * - Building with fewer than WEEK_MIN_DAY_DIGESTS sources
 * - Writing under a single mega AsyncStorage key (shard regression)
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
    },
}));

jest.mock('../../../services/ai/aiTransport', () => ({
    fetchAiChatCompletion: jest.fn(),
}));

import { fetchAiChatCompletion } from '../../../services/ai/aiTransport';
import {
    WEEK_MIN_DAY_DIGESTS,
    clearRollupAttemptsForTests,
    ensureMemoryRollupsUpToDate,
    resetRollupAttemptsAdapter,
    setRollupAttemptsAdapter,
} from '../../../services/memory/memoryRollupBuild';
import {
    clearMemoryRollups,
    getMemoryRollup,
    memoryRollupRecordKey,
    resetMemoryRollupStorageAdapter,
    setMemoryRollupStorageAdapter,
} from '../../../services/memory/memoryRollupStorage';
import {
    clearDayDigests,
    resetDayDigestStorageAdapter,
    setDayDigestStorageAdapter,
} from '../../../services/memory/dayDigestStorage';
import type { DayDigest } from '../../../services/memory/dayDigest.types';
import { DAY_DIGEST_STORAGE_KEY } from '../../../services/memory/dayDigestStorage';

function createSharedAdapter() {
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

const mockFetch = jest.mocked(fetchAiChatCompletion);

function seedDayDigests(adapter: ReturnType<typeof createSharedAdapter>, digests: DayDigest[]) {
    const days: Record<string, DayDigest> = {};
    digests.forEach((d) => {
        days[d.dateKey] = d;
    });
    adapter.store.set(
        DAY_DIGEST_STORAGE_KEY,
        JSON.stringify({ schemaVersion: 1, days }),
    );
}

describe('ensureMemoryRollupsUpToDate', () => {
    let adapter: ReturnType<typeof createSharedAdapter>;

    beforeEach(async () => {
        adapter = createSharedAdapter();
        setDayDigestStorageAdapter(adapter);
        setMemoryRollupStorageAdapter(adapter);
        setRollupAttemptsAdapter(adapter);
        await clearRollupAttemptsForTests();
        mockFetch.mockReset();
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            summary: 'A reflective week of work stress and rest.',
                            topics: ['work stress', 'rest'],
                        }),
                    },
                }],
            }),
            text: async () => '',
        } as Response);
    });

    afterEach(async () => {
        await clearMemoryRollups();
        await clearDayDigests();
        await clearRollupAttemptsForTests();
        resetMemoryRollupStorageAdapter();
        resetDayDigestStorageAdapter();
        resetRollupAttemptsAdapter();
    });

    it(`builds a week rollup when ≥${WEEK_MIN_DAY_DIGESTS} closed-week day digests exist`, async () => {
        // 2026-06-08..10 is a Mon–Wed in a week that ends 2026-06-14 (Sun).
        // "now" = 2026-07-17 so that week is closed.
        const now = new Date(2026, 6, 17);
        const days: DayDigest[] = [
            {
                dateKey: '2026-06-08',
                summary: 'Work was loud.',
                topics: ['work'],
                sources: [],
                entryCount: 1,
                updatedAt: 1,
            },
            {
                dateKey: '2026-06-09',
                summary: 'Rested in the evening.',
                topics: ['rest'],
                sources: [],
                entryCount: 1,
                updatedAt: 2,
            },
            {
                dateKey: '2026-06-10',
                summary: 'Talked about family.',
                topics: ['family'],
                sources: [],
                entryCount: 1,
                updatedAt: 3,
            },
        ];
        seedDayDigests(adapter, days);

        const result = await ensureMemoryRollupsUpToDate({ now, maxNew: 5 });
        expect(result.created.length).toBeGreaterThanOrEqual(1);
        const week = result.created.find((r) => r.kind === 'week');
        expect(week).toBeDefined();
        expect(week!.summary).toContain('work stress');
        expect(mockFetch).toHaveBeenCalled();

        // Sharded key present
        const key = memoryRollupRecordKey(week!.kind, week!.periodKey);
        expect(adapter.store.has(key)).toBe(true);
        expect(await getMemoryRollup(week!.kind, week!.periodKey)).not.toBeNull();
    });

    it('does not build for the open current week', async () => {
        const now = new Date(2026, 6, 15); // mid-week
        // Put digests in the *current* week around July 15 2026
        seedDayDigests(adapter, [
            {
                dateKey: '2026-07-13',
                summary: 'Today-ish A',
                topics: [],
                sources: [],
                entryCount: 1,
                updatedAt: 1,
            },
            {
                dateKey: '2026-07-14',
                summary: 'Today-ish B',
                topics: [],
                sources: [],
                entryCount: 1,
                updatedAt: 2,
            },
            {
                dateKey: '2026-07-15',
                summary: 'Today-ish C',
                topics: [],
                sources: [],
                entryCount: 1,
                updatedAt: 3,
            },
        ]);

        const result = await ensureMemoryRollupsUpToDate({ now, maxNew: 5 });
        const currentWeekRollups = result.created.filter((r) => r.kind === 'week');
        // Open week must not be materialized yet
        expect(currentWeekRollups.every((r) => r.dateTo < '2026-07-15')).toBe(true);
    });

    it('skips when fewer than min day digests in a closed week', async () => {
        const now = new Date(2026, 6, 17);
        seedDayDigests(adapter, [
            {
                dateKey: '2026-06-08',
                summary: 'Only one day',
                topics: [],
                sources: [],
                entryCount: 1,
                updatedAt: 1,
            },
        ]);
        const result = await ensureMemoryRollupsUpToDate({ now, maxNew: 5 });
        expect(result.created.filter((r) => r.kind === 'week')).toHaveLength(0);
    });

    /**
     * Offline thrash: failed LLM marks attempt; second ensure within backoff
     * must not call flash again.
     */
    it('backs off LLM after a failed attempt (no repeated open while offline)', async () => {
        const now = new Date(2026, 6, 17);
        seedDayDigests(adapter, [
            {
                dateKey: '2026-06-08',
                summary: 'Work was loud.',
                topics: ['work'],
                sources: [],
                entryCount: 1,
                updatedAt: 1,
            },
            {
                dateKey: '2026-06-09',
                summary: 'Rested.',
                topics: ['rest'],
                sources: [],
                entryCount: 1,
                updatedAt: 2,
            },
            {
                dateKey: '2026-06-10',
                summary: 'Family.',
                topics: ['family'],
                sources: [],
                entryCount: 1,
                updatedAt: 3,
            },
        ]);
        mockFetch.mockRejectedValue(new Error('offline'));

        const first = await ensureMemoryRollupsUpToDate({ now, maxNew: 5 });
        expect(first.created).toHaveLength(0);
        expect(mockFetch).toHaveBeenCalled();
        const callsAfterFirst = mockFetch.mock.calls.length;

        const second = await ensureMemoryRollupsUpToDate({ now, maxNew: 5 });
        expect(second.created).toHaveLength(0);
        // No additional LLM calls while backoff holds.
        expect(mockFetch.mock.calls.length).toBe(callsAfterFirst);
    });
});
