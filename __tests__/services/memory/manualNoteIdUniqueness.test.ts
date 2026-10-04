/* eslint-disable import/first */
/**
 * Regression test: two manual notes written in the same millisecond must stay
 * two distinct memories.
 *
 * `saveManualMemoryNote` keys its atom on `note:<Date.now()>`, and the atom id is
 * `${source}:${layer}:${sourceId}`. At millisecond resolution a tight caller —
 * the demo seed writes several notes in a loop — produced the SAME id twice, so
 * the second note merged into the first and was silently lost. The test freezes
 * the clock to force the collision deterministically.
 *
 * Fails on the pre-fix source (one atom, first note gone); passes with the
 * monotonic `manualNoteSequence` suffix.
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
    listMemoryAtoms,
    resetMemoryStorageAdapter,
    saveManualMemoryNote,
    setMemoryStorageAdapter,
} from '@/services/memory/localMemory';
import type { LocalMemoryAtom } from '@/services/memory/localMemory.types';
import { resetMemoryFilesStorageAdapter, setMemoryFilesStorageAdapter } from '@/services/memory/memoryFiles';

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
        setItem: async (key: string, value: string) => { store.set(key, value); },
        removeItem: async (key: string) => { store.delete(key); },
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

describe('manual notes: a same-millisecond write must not be lost', () => {
    let adapter: InMemoryAdapter;
    let files: InMemoryAdapter;

    beforeEach(() => {
        adapter = createAdapter();
        files = createAdapter();
        setMemoryStorageAdapter(adapter);
        setMemoryFilesStorageAdapter(files);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        resetMemoryStorageAdapter();
        resetMemoryFilesStorageAdapter();
    });

    it('keeps two distinct notes written inside one millisecond', async () => {
        // Freeze the clock: both writes land on the same Date.now().
        jest.spyOn(Date, 'now').mockReturnValue(1_790_000_000_000);

        const first = await saveManualMemoryNote('First note: the kiln cooled overnight.');
        const second = await saveManualMemoryNote('Second note: the kiln shattered at noon.');

        expect(second.id).not.toBe(first.id);

        const notes = (await listMemoryAtoms()).filter((atom) => atom.layer === 'note');
        expect(notes).toHaveLength(2);
        const contents = notes.map((atom) => atom.content).join(' | ');
        expect(contents).toContain('the kiln cooled overnight');
        expect(contents).toContain('the kiln shattered at noon');
    });

    it('still keeps a note\'s provenance prefix intact', async () => {
        jest.spyOn(Date, 'now').mockReturnValue(1_790_000_000_000);
        const note = await saveManualMemoryNote('A note about the kiln.');
        // memoryProvenance matches on this prefix, so the id scheme must keep it.
        expect(note.sourceId.startsWith('note:')).toBe(true);
    });

    it('produces one atom per note across many writes in the same millisecond', async () => {
        jest.spyOn(Date, 'now').mockReturnValue(1_790_000_000_000);
        const texts = ['one', 'two', 'three', 'four', 'five'];
        for (const t of texts) {
            await saveManualMemoryNote(`Note ${t}: something worth keeping.`);
        }
        const notes = (await listMemoryAtoms()).filter((atom) => atom.layer === 'note');
        expect(notes).toHaveLength(texts.length);
        expect(storedAtoms(adapter).filter((atom) => atom.layer === 'note')).toHaveLength(texts.length);
    });
});
