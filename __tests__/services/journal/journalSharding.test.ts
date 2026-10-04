/**
 * Journal storage sharding.
 *
 * A single `@journal_entries` value crossed Android's ~2MB per-key ceiling at
 * ~693 entries (~3KB each) and the write failed. These tests pin the fix:
 * shards + a lightweight index, a lossless idempotent v1 migration, a summary
 * read that never touches a shard, and single-shard getEntry.
 */

import {
    JOURNAL_ENTRIES_SCHEMA_VERSION,
    JOURNAL_ENTRIES_SHARD_COUNT,
    JOURNAL_ENTRIES_SHARD_KEY_PREFIX,
    JOURNAL_ENTRIES_STORAGE_KEY,
    clearAllEntries,
    createEntry,
    getEntry,
    listEntries,
    listEntrySummaries,
    resetStorageAdapter,
    setStorageAdapter,
} from '../../../services/journal/journalStorage';
import type { StorageAdapter } from '../../../services/journal/journalStorage.types';

function createTrackedAdapter(values: Map<string, string>) {
    const reads: string[] = [];
    const writes: string[] = [];
    const adapter: StorageAdapter = {
        getItem: async (key) => {
            reads.push(key);
            return values.get(key) ?? null;
        },
        setItem: async (key, value) => {
            writes.push(key);
            values.set(key, value);
        },
        removeItem: async (key) => {
            values.delete(key);
        },
    };
    return { adapter, reads, writes };
}

function entry(id: string) {
    return {
        id,
        title: `Title ${id}`,
        emoji: '📝',
        messages: [{ id: 'm1', role: 'user' as const, content: 'hello', timestamp: 1 }],
        status: 'completed' as const,
        createdAt: 1,
        updatedAt: 1,
    };
}

/** ~2.9KB per entry — matches the measured ~3026 bytes/completed entry. */
function bigEntry(id: string) {
    return {
        id,
        title: `Entry ${id}`,
        emoji: '📝',
        messages: [{ id: 'm1', role: 'user' as const, content: 'x'.repeat(2800), timestamp: 1 }],
        status: 'completed' as const,
        createdAt: 1,
        updatedAt: 1,
    };
}

function shardKeysIn(values: Map<string, string>): string[] {
    return [...values.keys()].filter((key) => key.startsWith(JOURNAL_ENTRIES_SHARD_KEY_PREFIX));
}

describe('journal storage sharding', () => {
    let values: Map<string, string>;
    let reads: string[];
    let writes: string[];

    beforeEach(() => {
        values = new Map();
        const tracked = createTrackedAdapter(values);
        reads = tracked.reads;
        writes = tracked.writes;
        setStorageAdapter(tracked.adapter);
    });

    afterEach(async () => {
        await clearAllEntries();
        resetStorageAdapter();
    });

    it('migrates a v1 single-key payload to shards, losslessly and idempotently', async () => {
        const v1 = { 'entry-a': entry('entry-a'), 'entry-b': entry('entry-b') };
        values.set(JOURNAL_ENTRIES_STORAGE_KEY, JSON.stringify(v1));

        const listed = await listEntries();
        expect(listed.map((e) => e.id).sort()).toEqual(['entry-a', 'entry-b']);

        // Rewritten as shards + a versioned index...
        expect(values.get(JOURNAL_ENTRIES_STORAGE_KEY)).toContain(
            `"shardCount":${JOURNAL_ENTRIES_SHARD_COUNT}`,
        );
        expect(values.get(JOURNAL_ENTRIES_STORAGE_KEY)).toContain(
            `"schemaVersion":${JOURNAL_ENTRIES_SCHEMA_VERSION}`,
        );
        expect(shardKeysIn(values).length).toBeGreaterThan(0);
        // ...and the old key is KEPT, repurposed as the index (not deleted).
        expect(values.has(JOURNAL_ENTRIES_STORAGE_KEY)).toBe(true);

        // Lossless: every entry is still readable through the owning module.
        await expect(getEntry('entry-a')).resolves.toMatchObject({ id: 'entry-a' });
        await expect(getEntry('entry-b')).resolves.toMatchObject({ id: 'entry-b' });

        // Idempotent: a second load does not rewrite the index.
        const indexAfterFirst = values.get(JOURNAL_ENTRIES_STORAGE_KEY);
        writes.length = 0;
        await listEntries();
        expect(values.get(JOURNAL_ENTRIES_STORAGE_KEY)).toBe(indexAfterFirst);
        expect(writes).toEqual([]);
    });

    it('keeps a full store sharded so no single key approaches the 2MB ceiling', async () => {
        const big: Record<string, ReturnType<typeof bigEntry>> = {};
        const count = 900;
        for (let i = 0; i < count; i += 1) big[`entry-${i}`] = bigEntry(`entry-${i}`);
        values.set(JOURNAL_ENTRIES_STORAGE_KEY, JSON.stringify(big));

        const beforeBytes = (values.get(JOURNAL_ENTRIES_STORAGE_KEY) ?? '').length;

        await listEntries();

        const afterShardBytes = shardKeysIn(values).map((key) => (values.get(key) ?? '').length);
        const indexBytes = (values.get(JOURNAL_ENTRIES_STORAGE_KEY) ?? '').length;
        const maxShardBytes = Math.max(...afterShardBytes);

        expect(beforeBytes).toBeGreaterThan(2 * 1024 * 1024);
        expect(afterShardBytes.length).toBeGreaterThan(1);
        expect(maxShardBytes).toBeLessThan(2 * 1024 * 1024);
        expect(indexBytes).toBeLessThan(2 * 1024 * 1024);
        // Every entry survived the migration.
        expect(await getEntry('entry-0')).toMatchObject({ id: 'entry-0' });
        expect(await getEntry(`entry-${count - 1}`)).toMatchObject({ id: `entry-${count - 1}` });
    });

    it('serves a summary list from the index alone, without reading any shard', async () => {
        await createEntry({ title: 'First', status: 'draft', messages: [] });
        await createEntry({ title: 'Second', status: 'completed', messages: [] });

        reads.length = 0;
        const summaries = await listEntrySummaries();

        expect(summaries).toHaveLength(2);
        expect(summaries.map((s) => s.title).sort()).toEqual(['First', 'Second']);
        expect(reads).toContain(JOURNAL_ENTRIES_STORAGE_KEY);
        expect(reads.filter((key) => key.startsWith(JOURNAL_ENTRIES_SHARD_KEY_PREFIX))).toEqual([]);
    });

    it('reads only the one shard that owns an id', async () => {
        const created = await createEntry({ title: 'Only', status: 'completed', messages: [] });

        reads.length = 0;
        const found = await getEntry(created.id);

        expect(found?.id).toBe(created.id);
        expect(
            reads.filter((key) => key.startsWith(JOURNAL_ENTRIES_SHARD_KEY_PREFIX)),
        ).toHaveLength(1);
    });

    it('places each entry in exactly one shard and clears every shard on wipe', async () => {
        const created = await createEntry({ title: 'A', status: 'completed', messages: [] });
        const owningShards = shardKeysIn(values).filter((key) =>
            (values.get(key) ?? '').includes(created.id),
        );
        expect(owningShards).toHaveLength(1);

        await clearAllEntries();
        expect(values.has(JOURNAL_ENTRIES_STORAGE_KEY)).toBe(false);
        expect(shardKeysIn(values)).toEqual([]);
    });
});
