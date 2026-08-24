/* eslint-disable import/first */
/**
 * Sharded session digests.
 *
 * What would make these fail?
 * - Collapsing digests into one growing JSON array under a single key
 * - Writing embeddings into the index blob
 * - Losing digests after a simulated process restart (fresh read from same store)
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        multiGet: jest.fn(),
        multiRemove: jest.fn(),
        getAllKeys: jest.fn(),
    },
}));

import {
    SESSION_DIGEST_INDEX_KEY,
    SESSION_DIGEST_KEY_PREFIX,
    clearSessionDigests,
    exportSessionDigestsBundle,
    getSessionDigest,
    importSessionDigestsBundle,
    listSessionDigestIndex,
    listSessionDigests,
    resetSessionDigestStorageAdapter,
    sessionDigestRecordKey,
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

function sampleDigest(overrides: Partial<SessionDigest> = {}): SessionDigest {
    return {
        schemaVersion: 1,
        sessionId: 'entry_abc',
        dateISO: '2026-07-17',
        oneLineSummary: 'Talked about work stress and poor sleep.',
        topics: ['work stress', 'sleep'],
        entryWordCount: 42,
        createdAt: 1_700_000_000_000,
        sourceKind: 'journal_entry',
        sourceId: 'entry_abc',
        ...overrides,
    };
}

describe('sessionDigestStorage (sharded)', () => {
    let adapter: ReturnType<typeof createInMemoryAdapter>;

    beforeEach(() => {
        adapter = createInMemoryAdapter();
        setSessionDigestStorageAdapter(adapter);
    });

    afterEach(async () => {
        await clearSessionDigests();
        resetSessionDigestStorageAdapter();
    });

    it('writes one record key per digest plus a lightweight index (no embeddings in index)', async () => {
        const saved = await upsertSessionDigest(sampleDigest());
        expect(saved.sessionId).toBe('entry_abc');

        const recordKey = sessionDigestRecordKey('entry_abc');
        expect(recordKey).toBe(`${SESSION_DIGEST_KEY_PREFIX}entry_abc`);
        expect(adapter.store.has(recordKey)).toBe(true);
        expect(adapter.store.has(SESSION_DIGEST_INDEX_KEY)).toBe(true);

        // Index must stay tiny — ids/dates only.
        const indexJson = adapter.store.get(SESSION_DIGEST_INDEX_KEY) ?? '';
        expect(indexJson).not.toContain('embedding');
        expect(indexJson).not.toContain('oneLineSummary');
        expect(indexJson).toContain('entry_abc');
        expect(indexJson).toContain('2026-07-17');

        // Record holds the text digest (no vector anymore).
        const recordJson = adapter.store.get(recordKey) ?? '';
        expect(recordJson).not.toContain('embedding');
        expect(recordJson).toContain('work stress');
    });

    /**
     * Sabotage target (b): digest survives app restart.
     * What would make this fail: only keeping digests in memory / skipping setItem.
     */
    it('survives simulated restart (fresh read from same persistent map)', async () => {
        await upsertSessionDigest(sampleDigest({
            sessionId: 'sess_restart',
            sourceId: 'sess_restart',
            oneLineSummary: 'Mentioned sister and mom health.',
        }));

        // Simulate process death: new adapter module path still points at same store map,
        // then re-bind adapter as a cold start would (same AsyncStorage contents).
        const cold = {
            getItem: adapter.getItem,
            setItem: adapter.setItem,
            removeItem: adapter.removeItem,
            multiGet: adapter.multiGet,
            multiRemove: adapter.multiRemove,
            getAllKeys: adapter.getAllKeys,
        };
        setSessionDigestStorageAdapter(cold);

        const loaded = await getSessionDigest('sess_restart');
        expect(loaded?.oneLineSummary).toContain('sister');
        expect(loaded?.topics).toContain('work stress');

        const listed = await listSessionDigests();
        expect(listed.some((d) => d.sessionId === 'sess_restart')).toBe(true);

        // eslint-disable-next-line no-console
        console.log(
            '[session-digest-diag] after restart getSessionDigest:',
            JSON.stringify(loaded, null, 2),
        );
    });

    it('filters index by date range without loading all embeddings first', async () => {
        await upsertSessionDigest(sampleDigest({
            sessionId: 'a',
            sourceId: 'a',
            dateISO: '2026-06-01',
            createdAt: 100,
        }));
        await upsertSessionDigest(sampleDigest({
            sessionId: 'b',
            sourceId: 'b',
            dateISO: '2026-07-15',
            createdAt: 200,
        }));
        await upsertSessionDigest(sampleDigest({
            sessionId: 'c',
            sourceId: 'c',
            dateISO: '2026-08-01',
            createdAt: 300,
        }));

        const july = await listSessionDigestIndex({ from: '2026-07-01', to: '2026-07-31' });
        expect(july.map((e) => e.id)).toEqual(['b']);
    });

    it('export/import bundle round-trips sharded records', async () => {
        await upsertSessionDigest(sampleDigest({ sessionId: 'x1', sourceId: 'x1' }));
        const bundle = await exportSessionDigestsBundle();
        expect(bundle).toBeTruthy();

        await clearSessionDigests();
        expect(await listSessionDigests()).toEqual([]);

        await importSessionDigestsBundle(bundle);
        const again = await getSessionDigest('x1');
        expect(again?.oneLineSummary).toContain('work stress');
    });

    it('clearSessionDigests removes index and all record keys', async () => {
        await upsertSessionDigest(sampleDigest({ sessionId: 'z1', sourceId: 'z1' }));
        await upsertSessionDigest(sampleDigest({ sessionId: 'z2', sourceId: 'z2' }));
        await clearSessionDigests();
        expect(adapter.store.size).toBe(0);
        expect(await listSessionDigestIndex()).toEqual([]);
    });
});
