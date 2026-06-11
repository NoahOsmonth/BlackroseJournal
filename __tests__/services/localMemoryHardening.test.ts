/* eslint-disable import/first */

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
    },
}));

import {
    LOCAL_MEMORY_CORRUPT_BACKUP_KEY,
    LOCAL_MEMORY_STORAGE_KEY,
    MAX_MEMORY_ATOMS,
    buildLocalMemoryContext,
    clearMemoryAtoms,
    deleteMemoryAtom,
    listMemoryAtoms,
    resetMemoryStorageAdapter,
    retrieveLocalMemories,
    saveJournalEntryMemories,
    saveManualMemoryNote,
    setMemoryStorageAdapter,
    subscribeMemoryChanges,
    upsertMemoryAtom,
} from '@/services/memory/localMemory';
import type { JournalEntry } from '@/services/journal/journalStorage.types';

interface InMemoryAdapter {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
    store: Map<string, string>;
    getItemDelayMs?: number;
}

function createInMemoryAdapter(): InMemoryAdapter {
    const store = new Map<string, string>();
    return {
        store,
        async getItem(key: string) {
            if (this.getItemDelayMs) {
                await new Promise((resolve) => setTimeout(resolve, this.getItemDelayMs));
            }
            return store.get(key) ?? null;
        },
        async setItem(key: string, value: string) {
            store.set(key, value);
        },
        async removeItem(key: string) {
            store.delete(key);
        },
    };
}

function buildJournalEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
    const messages = overrides.messages ?? [{
        id: 'u1',
        role: 'user' as const,
        content: 'I had a good walk today and felt grounded.',
        timestamp: 1_700_000_000_000,
    }];
    const analysis = overrides.analysis ?? {
        insight: 'Walking brings calm.',
        quote: 'A simple walk grounds me.',
        mood: 'Calm',
        topics: ['walking', 'calm'],
        generatedAt: 1_700_000_000_000,
    };
    const base: Partial<JournalEntry> = {
        id: overrides.id ?? `entry_${Math.random().toString(36).slice(2, 8)}`,
        title: overrides.title ?? 'Reflection',
        emoji: '🚶',
        messages,
        analysis,
        createdAt: overrides.createdAt ?? 1_700_000_000_000,
        updatedAt: overrides.updatedAt ?? 1_700_000_000_000,
        status: overrides.status ?? 'completed',
    };
    return base as unknown as JournalEntry;
}

describe('localMemory hardening', () => {
    let adapter: InMemoryAdapter;

    beforeEach(() => {
        adapter = createInMemoryAdapter();
        setMemoryStorageAdapter(adapter);
    });

    afterEach(() => {
        resetMemoryStorageAdapter();
    });

    it('recovers from a corrupted JSON payload without throwing', async () => {
        adapter.store.set(LOCAL_MEMORY_STORAGE_KEY, '{not json');

        await expect(listMemoryAtoms()).resolves.toEqual([]);
        expect(adapter.store.get(LOCAL_MEMORY_CORRUPT_BACKUP_KEY)).toBe('{not json');
        expect(adapter.store.has(LOCAL_MEMORY_STORAGE_KEY)).toBe(false);
    });

    it('migrates a v1 raw atom map into the v2 envelope on first write', async () => {
        const v1Atom = {
            id: 'journal:episodic:legacy-1',
            layer: 'episodic',
            source: 'journal',
            sourceId: 'legacy-1',
            title: 'Legacy',
            content: 'Legacy content',
            tags: ['legacy'],
            salience: 0.5,
            confidence: 0.5,
            createdAt: 1,
            updatedAt: 1,
            accessCount: 0,
        };
        adapter.store.set(LOCAL_MEMORY_STORAGE_KEY, JSON.stringify({ [v1Atom.id]: v1Atom }));

        const atoms = await listMemoryAtoms();
        expect(atoms).toHaveLength(1);
        expect(atoms[0].title).toBe('Legacy');

        await upsertMemoryAtom({
            layer: 'note',
            source: 'manual',
            sourceId: 'note:1',
            title: 'Fresh',
            content: 'Fresh content',
        });

        const raw = adapter.store.get(LOCAL_MEMORY_STORAGE_KEY);
        const envelope = JSON.parse(raw!);
        expect(envelope.schemaVersion).toBe(2);
        expect(Object.keys(envelope.atoms)).toHaveLength(2);
    });

    it('drops invalid atoms but keeps valid ones when loading v1 data', async () => {
        adapter.store.set(LOCAL_MEMORY_STORAGE_KEY, JSON.stringify({
            valid: {
                id: 'journal:episodic:keep-1',
                layer: 'episodic',
                source: 'journal',
                sourceId: 'keep-1',
                title: 'Keep',
                content: 'Keep me',
                tags: [],
                salience: 0.5,
                confidence: 0.5,
                createdAt: 1,
                updatedAt: 1,
                accessCount: 0,
            },
            broken: 'oops',
        }));

        const atoms = await listMemoryAtoms();
        expect(atoms).toHaveLength(1);
        expect(atoms[0].title).toBe('Keep');
    });

    it('serializes concurrent writes so neither side is lost', async () => {
        adapter.getItemDelayMs = 10;

        await Promise.all([
            upsertMemoryAtom({
                layer: 'episodic',
                source: 'journal',
                sourceId: 'a',
                title: 'A',
                content: 'a',
            }),
            upsertMemoryAtom({
                layer: 'episodic',
                source: 'journal',
                sourceId: 'b',
                title: 'B',
                content: 'b',
            }),
        ]);

        const atoms = await listMemoryAtoms();
        const ids = atoms.map((atom) => atom.sourceId);
        expect(ids).toEqual(expect.arrayContaining(['a', 'b']));
    });

    it('caps the atom map at MAX_MEMORY_ATOMS and protects manual notes', async () => {
        const overflow = MAX_MEMORY_ATOMS + 25;
        for (let i = 0; i < overflow; i += 1) {
            await upsertMemoryAtom({
                layer: 'episodic',
                source: 'journal',
                sourceId: `j_${i}`,
                title: `Journal ${i}`,
                content: 'content',
            });
        }

        let atoms = await listMemoryAtoms();
        expect(atoms.length).toBeLessThanOrEqual(MAX_MEMORY_ATOMS);

        const manual = await saveManualMemoryNote('keep me');
        for (let i = 0; i < 50; i += 1) {
            await upsertMemoryAtom({
                layer: 'episodic',
                source: 'journal',
                sourceId: `j_post_${i}`,
                title: `Post ${i}`,
                content: 'content',
            });
        }
        atoms = await listMemoryAtoms();
        expect(atoms.find((atom) => atom.id === manual.id)).toBeDefined();
    });

    it('notifies subscribers on mutation but not on access bookkeeping', async () => {
        const listener = jest.fn();
        const unsubscribe = subscribeMemoryChanges(listener);

        await upsertMemoryAtom({
            layer: 'note',
            source: 'manual',
            sourceId: 'note:99',
            title: 'Heads up',
            content: 'notify me',
        });
        expect(listener).toHaveBeenCalledTimes(1);

        await upsertMemoryAtom({
            layer: 'note',
            source: 'manual',
            sourceId: 'note:100',
            title: 'Seed',
            content: 'seed for retrieval',
            tags: ['calm'],
        });
        await retrieveLocalMemories({ query: 'calm' });

        expect(listener).toHaveBeenCalledTimes(2);

        unsubscribe();
        await upsertMemoryAtom({
            layer: 'note',
            source: 'manual',
            sourceId: 'note:101',
            title: 'No listener',
            content: 'n/a',
        });
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it('keeps the memory capsule under the char budget and at most 6 atoms', async () => {
        for (let i = 0; i < 10; i += 1) {
            await saveJournalEntryMemories(buildJournalEntry({
                id: `entry_${i}`,
                title: `Entry ${i}`,
                messages: [{
                    id: `u_${i}`,
                    role: 'user',
                    content: 'I had a calm walk today and felt grounded in the morning light.',
                    timestamp: 1_700_000_000_000 + i * 1000,
                }],
                analysis: {
                    insight: 'Walking in the morning helps with focus and calm.',
                    quote: 'Mornings hold me.',
                    mood: 'Steady',
                    topics: ['walking', 'morning', 'calm'],
                    generatedAt: 1_700_000_000_000 + i * 1000,
                },
                createdAt: 1_700_000_000_000 + i * 1000,
            }));
        }

        const capsule = await buildLocalMemoryContext({});
        expect(capsule).toBeDefined();
        expect(capsule!.length).toBeLessThanOrEqual(1600);

        const atomLines = capsule!.split('\n').filter((line) => line.startsWith('- '));
        expect(atomLines.length).toBeLessThanOrEqual(6);
    });

    it('clears and deletes atoms safely', async () => {
        const atom = await upsertMemoryAtom({
            layer: 'note',
            source: 'manual',
            sourceId: 'note:42',
            title: 'Clear me',
            content: 'bye',
        });
        expect(await deleteMemoryAtom(atom.id)).toBe(true);
        expect(await deleteMemoryAtom(atom.id)).toBe(false);

        await saveManualMemoryNote('something');
        await clearMemoryAtoms();
        expect(await listMemoryAtoms()).toEqual([]);
    });
});
