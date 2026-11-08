import {
    listEntries,
    resetStorageAdapter,
    setStorageAdapter,
} from '@/services/journal/journalStorage';

/**
 * Rule R2: one read per collection.
 *
 * The index key was read twice on every list — once by ensureMigrated to ask
 * whether the pre-shard v1 payload was still there, once by loadStore to build
 * the map. That was half of the duplicated @journal_entries reads the
 * tab-switch bench counted (21 reads per switch against a budget of 25).
 *
 * loadStore already parses the index and reports `legacy`, so the second read
 * bought nothing.
 */

const store = new Map<string, string>();
let indexReads = 0;

function install(options: { legacy?: boolean } = {}) {
    store.clear();
    indexReads = 0;
    const entry = {
        id: 'e1',
        title: 'A day',
        emoji: '🌹',
        status: 'completed' as const,
        createdAt: 1,
        updatedAt: 1,
    };
    if (options.legacy) {
        // Pre-shard shape: the index key itself held the entries.
        store.set('@journal_entries', JSON.stringify({ entries: { e1: entry } }));
    } else {
        store.set('@journal_entries', JSON.stringify({ schemaVersion: 2, shardCount: 16 }));
        store.set('@journal_entries_shard:0', JSON.stringify({ entries: { e1: entry } }));
    }
    setStorageAdapter({
        getItem: async (key: string) => {
            if (key === '@journal_entries') indexReads += 1;
            return store.get(key) ?? null;
        },
        setItem: async (key: string, value: string) => { store.set(key, value); },
        removeItem: async (key: string) => { store.delete(key); },
    } as never);
}

describe('journal index is read once per list', () => {
    afterEach(() => {
        resetStorageAdapter();
    });

    it('reads the index exactly once for a sharded store', async () => {
        install();
        const entries = await listEntries();
        expect(entries).toHaveLength(1);
        expect(indexReads).toBe(1);
    });

    it('still reads the entries when they live in the index (v1)', async () => {
        install({ legacy: true });
        const entries = await listEntries();
        expect(entries).toHaveLength(1);
        expect(entries[0].title).toBe('A day');
    });

    it('migrates a v1 payload into shards on a list', async () => {
        install({ legacy: true });
        await listEntries();
        // The index keeps its new sharded header shape, entries move to shards.
        const header = JSON.parse(store.get('@journal_entries') ?? '{}');
        expect('shardCount' in header).toBe(true);
        const shardKeys = [...store.keys()].filter((k) => k.startsWith('@journal_entries_shard:'));
        const shards = shardKeys.map((k) => store.get(k) ?? '').join('');
        expect(shards).toContain('A day');
    });
});
