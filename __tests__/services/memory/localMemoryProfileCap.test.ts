/* eslint-disable import/first */
/**
 * Regression tests for the four ways the atom store used to destroy memory.
 *
 * Each block fails on the original `localMemory.ts` and passes on the fixed one:
 *  1. the 3-slot profile cap hard-deleted the losers (permanent, invisible,
 *     unrecoverable from a backup);
 *  2. `importMemoryBundle` bypassed the cap entirely;
 *  3. manual notes escaped `MAX_MEMORY_ATOMS` (the store was unbounded);
 *  4. `saveManualMemoryNote` wrote no memory file, so `memory_search` could
 *     never find a manual note ("two stores, one bridge", AGENTS.md rule 9).
 *
 * A monotonic `Date.now` makes the cap's newest-wins tie-break deterministic
 * without real delays.
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
    MAX_MEMORY_ATOMS,
    exportMemoryBundle,
    importMemoryAtoms,
    importMemoryBundle,
    listMemoryAtoms,
    resetMemoryStorageAdapter,
    retrieveLocalMemories,
    saveManualMemoryNote,
    setMemoryStorageAdapter,
    upsertMemoryAtom,
} from '@/services/memory/localMemory';
import type { LocalMemoryAtom, LocalMemoryAtomInput } from '@/services/memory/localMemory.types';
import {
    listMemoryFiles,
    resetMemoryFilesStorageAdapter,
    setMemoryFilesStorageAdapter,
} from '@/services/memory/memoryFiles';

interface InMemoryAdapter {
    store: Map<string, string>;
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
}

function createAdapter(): InMemoryAdapter {
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
    };
}

/** Every atom physically in the shard keys, retired ones included. */
function storedAtoms(adapter: InMemoryAdapter): LocalMemoryAtom[] {
    const atoms: LocalMemoryAtom[] = [];
    for (let index = 0; index < LOCAL_MEMORY_SHARD_COUNT; index += 1) {
        const raw = adapter.store.get(`${LOCAL_MEMORY_SHARD_KEY_PREFIX}${String(index)}`);
        if (!raw) continue;
        atoms.push(...Object.values(JSON.parse(raw).atoms as Record<string, LocalMemoryAtom>));
    }
    return atoms;
}

function profile(topic: string, salience = 0.68): LocalMemoryAtomInput {
    return {
        layer: 'profile',
        source: 'journal',
        sourceId: `profile:${topic}`,
        title: topic,
        content: `${topic} matters to me`,
        tags: [topic],
        salience,
        confidence: 0.78,
    };
}

const profileTitles = (atoms: LocalMemoryAtom[]): string[] =>
    atoms.filter((atom) => atom.layer === 'profile').map((atom) => atom.title).sort();

describe('localMemory profile cap: retire, never destroy', () => {
    let adapter: InMemoryAdapter;
    let files: InMemoryAdapter;
    let clock: number;

    beforeEach(() => {
        adapter = createAdapter();
        files = createAdapter();
        setMemoryStorageAdapter(adapter);
        setMemoryFilesStorageAdapter(files);
        clock = 1_000_000;
        jest.spyOn(Date, 'now').mockImplementation(() => (clock += 1_000));
    });

    afterEach(() => {
        jest.restoreAllMocks();
        resetMemoryStorageAdapter();
        resetMemoryFilesStorageAdapter();
    });

    it('keeps the losing profile atoms in storage and in the backup bundle', async () => {
        for (const topic of ['running', 'father', 'career', 'sobriety', 'loneliness']) {
            await upsertMemoryAtom(profile(topic));
        }

        // Only three are live…
        const live = await listMemoryAtoms();
        expect(profileTitles(live)).toHaveLength(3);

        // …but all five are still in storage, flagged retired.
        const stored = storedAtoms(adapter);
        expect(stored).toHaveLength(5);
        expect(stored.filter((atom) => typeof atom.retiredAt === 'number')).toHaveLength(2);
        expect(stored.map((atom) => atom.title).sort())
            .toEqual(['career', 'father', 'loneliness', 'running', 'sobriety']);

        // …and a backup carries every one of them, so the loss is recoverable.
        const bundle = await exportMemoryBundle();
        expect(bundle).toContain('"sobriety"');
        expect(bundle).toContain('"loneliness"');
    });

    it('keeps retired atoms out of the retrieval capsule', async () => {
        for (const topic of ['running', 'father', 'career', 'sobriety', 'loneliness']) {
            await upsertMemoryAtom(profile(topic));
        }
        const liveTitles = profileTitles(await listMemoryAtoms());

        const retrieved = await retrieveLocalMemories({ query: 'career sobriety loneliness', limit: 8 });
        const retrievedProfiles = retrieved.filter((atom) => atom.layer === 'profile');
        expect(retrievedProfiles.length).toBeLessThanOrEqual(3);
        expect(retrievedProfiles.every((atom) => liveTitles.includes(atom.title))).toBe(true);
    });

    it('ranks the cap by declared importance, not by how often a topic recurs', async () => {
        // The recurrence bug: a low-importance topic written 6x matured its
        // salience past a more important single-write topic and pushed it out.
        for (let i = 0; i < 6; i += 1) {
            await upsertMemoryAtom(profile('trivial', 0.5));
        }
        await upsertMemoryAtom(profile('weighty', 0.62));
        await upsertMemoryAtom(profile('anchor-one', 0.9));
        await upsertMemoryAtom(profile('anchor-two', 0.9));

        const live = profileTitles(await listMemoryAtoms());
        expect(live).toEqual(['anchor-one', 'anchor-two', 'weighty']);
        expect(live).toContain('weighty');
        expect(live).not.toContain('trivial');
    });

    it('keeps the newest profile atom on an equal-score tie', async () => {
        for (const topic of ['oldest', 'middle', 'newer', 'newest']) {
            await upsertMemoryAtom(profile(topic, 0.7));
        }

        const live = profileTitles(await listMemoryAtoms());
        expect(live).toContain('newest');
        expect(live).not.toContain('oldest');
    });

    it('resurrects a retired atom when it is written about again', async () => {
        for (const topic of ['running', 'father', 'career', 'sobriety']) {
            await upsertMemoryAtom(profile(topic, 0.6));
        }
        const retired = storedAtoms(adapter).find((atom) => typeof atom.retiredAt === 'number');
        expect(retired).toBeDefined();

        // Re-writing with enough importance clears retiredAt and wins a slot.
        await upsertMemoryAtom(profile(retired!.title, 0.99));
        const live = await listMemoryAtoms();
        expect(live.some((atom) => atom.title === retired!.title)).toBe(true);
        // Exactly one of the four is retired again — the newly-weakest one.
        expect(storedAtoms(adapter).filter((atom) => typeof atom.retiredAt === 'number')).toHaveLength(1);
        expect(storedAtoms(adapter).find((atom) => atom.title === retired!.title)?.retiredAt).toBeUndefined();
    });

    it('caps a 4-profile bundle on import, like every other write path', async () => {
        const bundle = JSON.stringify({
            schemaVersion: 3,
            atoms: Object.fromEntries(['a', 'b', 'c', 'd'].map((topic) => [
                `journal:profile:profile:${topic}`,
                {
                    id: `journal:profile:profile:${topic}`,
                    layer: 'profile',
                    source: 'journal',
                    sourceId: `profile:${topic}`,
                    title: topic,
                    content: `${topic} content`,
                    tags: [topic],
                    salience: 0.7,
                    confidence: 0.8,
                    createdAt: 1,
                    updatedAt: 1,
                    accessCount: 0,
                },
            ])),
        });

        await importMemoryBundle(bundle);

        expect(profileTitles(await listMemoryAtoms())).toHaveLength(3);
        // Nothing is destroyed: the fourth is retired, not deleted.
        expect(storedAtoms(adapter)).toHaveLength(4);
    });

    it('bounds the store at MAX_MEMORY_ATOMS even when manual notes alone exceed it', async () => {
        const manual: LocalMemoryAtomInput[] = Array.from(
            { length: MAX_MEMORY_ATOMS + 1 },
            (_, index) => ({
                layer: 'note',
                source: 'manual',
                sourceId: `m${String(index)}`,
                title: `m${String(index)}`,
                content: 'manual note',
                salience: 0.5,
                confidence: 0.5,
            }),
        );

        await importMemoryAtoms(manual);

        expect(await listMemoryAtoms()).toHaveLength(MAX_MEMORY_ATOMS);
    });

    it('stages a memory file for a manual note so memory_search can find it', async () => {
        await saveManualMemoryNote('Remember the lighthouse trip on Tuesday.');

        const found = await listMemoryFiles({ query: 'lighthouse', limit: 10 });
        expect(found).toHaveLength(1);
        expect(found[0].type).toBe('note');
        expect(found[0].sourceSessionKey).toBeTruthy();
    });
});
