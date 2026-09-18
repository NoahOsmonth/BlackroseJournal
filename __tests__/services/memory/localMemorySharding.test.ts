/* eslint-disable import/first */
/**
 * Sharded atom storage.
 *
 * The store used to be one AsyncStorage value under `@rosebud_local_memory`,
 * which is why `MAX_MEMORY_ATOMS` sat at 400: a 4000-atom store is a ~2 MB value
 * and Android's per-key ceiling is ~2 MB. These tests pin the properties that
 * make the larger cap safe — no single key holds the whole store, one bad shard
 * cannot take the others down, and the crash window during migration does not
 * lose or resurrect atoms.
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
    LOCAL_MEMORY_SHARD_COUNT,
    LOCAL_MEMORY_SHARD_KEY_PREFIX,
    LOCAL_MEMORY_STORAGE_KEY,
    MAX_MEMORY_ATOMS,
    clearMemoryAtoms,
    exportMemoryBundle,
    importMemoryAtoms,
    importMemoryBundle,
    listMemoryAtoms,
    resetMemoryStorageAdapter,
    setMemoryStorageAdapter,
    upsertMemoryAtom,
} from '@/services/memory/localMemory';
import type { LocalMemoryAtomInput } from '@/services/memory/localMemory.types';

/** Android's per-key ceiling is ~2 MB; this is the budget a single key must stay under. */
const PER_KEY_BUDGET_CHARS = 512 * 1024;

const ATOM_CONTENT = (
    'I walked out to the lighthouse and thought about how much of this week I have spent '
    + 'waiting for news that never arrived, and about what I want to do with that waiting.'
).slice(0, 420);

function createAdapter() {
    const store = new Map<string, string>();
    const writes: string[] = [];
    return {
        store,
        writes,
        async getItem(key: string) {
            return store.get(key) ?? null;
        },
        async setItem(key: string, value: string) {
            store.set(key, value);
            writes.push(key);
        },
        async removeItem(key: string) {
            store.delete(key);
        },
    };
}

function journalAtoms(count: number): LocalMemoryAtomInput[] {
    return Array.from({ length: count }, (_, index) => ({
        layer: 'episodic' as const,
        source: 'journal' as const,
        sourceId: `entry-${String(index)}`,
        title: `Reflection ${String(index)}`,
        content: ATOM_CONTENT,
        tags: ['walking', 'lighthouse', 'patience'],
        createdAt: Date.UTC(2026, 0, 1) + index * 86_400_000,
    }));
}

function shardEntries(store: Map<string, string>): [string, string][] {
    return [...store.entries()].filter(([key]) => key.startsWith(LOCAL_MEMORY_SHARD_KEY_PREFIX));
}

describe('sharded atom storage', () => {
    let adapter: ReturnType<typeof createAdapter>;

    beforeEach(() => {
        adapter = createAdapter();
        setMemoryStorageAdapter(adapter);
    });

    afterEach(() => {
        resetMemoryStorageAdapter();
    });

    it('keeps a full store spread across keys instead of one ~2MB value', async () => {
        await importMemoryAtoms(journalAtoms(MAX_MEMORY_ATOMS));

        const shards = shardEntries(adapter.store);
        expect(shards).toHaveLength(LOCAL_MEMORY_SHARD_COUNT);

        const sizes = shards.map(([, value]) => value.length);
        expect(Math.max(...sizes)).toBeLessThan(PER_KEY_BUDGET_CHARS);
        // The store genuinely does not fit in one key — that is why it is sharded.
        expect(sizes.reduce((total, size) => total + size, 0)).toBeGreaterThan(PER_KEY_BUDGET_CHARS);

        expect(await listMemoryAtoms()).toHaveLength(MAX_MEMORY_ATOMS);
    });

    it('carries a header in the index value, never atoms', async () => {
        await importMemoryAtoms(journalAtoms(50));

        const raw = adapter.store.get(LOCAL_MEMORY_STORAGE_KEY)!;
        const index = JSON.parse(raw);
        expect(index.atoms).toBeUndefined();
        expect(index.shardCount).toBe(LOCAL_MEMORY_SHARD_COUNT);
        expect(index.atomCount).toBe(50);
        expect(raw.length).toBeLessThan(200);
    });

    it('writes only the shard the changed atom lives in', async () => {
        await importMemoryAtoms(journalAtoms(20));
        adapter.writes.length = 0;

        await upsertMemoryAtom({
            layer: 'note',
            source: 'manual',
            sourceId: 'note:1',
            title: 'One',
            content: 'one',
        });

        expect(adapter.writes.filter((key) => key.startsWith(LOCAL_MEMORY_SHARD_KEY_PREFIX)))
            .toHaveLength(1);
        // The atom count moved, so the header is refreshed; no other shard is touched.
        expect(adapter.writes).toContain(LOCAL_MEMORY_STORAGE_KEY);
    });

    it('survives one corrupt shard without losing the others', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        try {
            await importMemoryAtoms(journalAtoms(60));
            const shards = shardEntries(adapter.store);
            expect(shards.length).toBeGreaterThan(1);

            const [brokenKey, brokenValue] = shards[0];
            const brokenCount = Object.keys(JSON.parse(brokenValue).atoms).length;
            adapter.store.set(brokenKey, `${brokenValue.slice(0, 6)}`);

            const atoms = await listMemoryAtoms();
            expect(atoms).toHaveLength(60 - brokenCount);
            expect(atoms.length).toBeGreaterThan(0);
            expect(adapter.store.has(brokenKey)).toBe(false);
            expect(warn.mock.calls.some(([msg]) => String(msg).includes('corrupt payload'))).toBe(true);
        } finally {
            warn.mockRestore();
        }
    });

    it('folds a pre-shard payload in without overwriting the newer shard copy', async () => {
        // The crash window: shards written, the index key still holding the older
        // single-value payload from before the migration.
        await upsertMemoryAtom({
            layer: 'note',
            source: 'manual',
            sourceId: 'note:9',
            title: 'Newer',
            content: 'from the shards',
        });
        adapter.store.set(LOCAL_MEMORY_STORAGE_KEY, JSON.stringify({
            schemaVersion: 2,
            atoms: {
                'manual:note:note:9': {
                    id: 'manual:note:note:9',
                    layer: 'note',
                    source: 'manual',
                    sourceId: 'note:9',
                    title: 'Older',
                    content: 'from the legacy value',
                    tags: [],
                    salience: 0.5,
                    confidence: 0.5,
                    createdAt: 1,
                    updatedAt: 1,
                    accessCount: 0,
                },
                'journal:episodic:older-entry': {
                    id: 'journal:episodic:older-entry',
                    layer: 'episodic',
                    source: 'journal',
                    sourceId: 'older-entry',
                    title: 'Older entry',
                    content: 'predates sharding',
                    tags: [],
                    salience: 0.5,
                    confidence: 0.5,
                    createdAt: 1,
                    updatedAt: 1,
                    accessCount: 0,
                },
            },
        }));

        const atoms = await listMemoryAtoms();
        expect(atoms).toHaveLength(2);
        expect(atoms.find((atom) => atom.id === 'manual:note:note:9')?.title).toBe('Newer');
        expect(atoms.find((atom) => atom.id === 'journal:episodic:older-entry')).toBeDefined();
    });

    it('clears every shard and the index', async () => {
        await importMemoryAtoms(journalAtoms(40));
        expect(adapter.store.size).toBeGreaterThan(1);

        await clearMemoryAtoms();

        expect(adapter.store.size).toBe(0);
        expect(await listMemoryAtoms()).toEqual([]);
    });

    it('round-trips the store through a backup bundle', async () => {
        await importMemoryAtoms(journalAtoms(40));
        const bundle = await exportMemoryBundle();

        await clearMemoryAtoms();
        expect(await exportMemoryBundle()).toBeNull();

        await importMemoryBundle(bundle);
        expect(await listMemoryAtoms()).toHaveLength(40);

        await importMemoryBundle(null);
        expect(await listMemoryAtoms()).toEqual([]);
    });
});
