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
    buildLocalMemoryContext,
    clearMemoryAtoms,
    listMemoryAtoms,
    resetMemoryStorageAdapter,
    deleteMemoryAtom,
    saveManualMemoryNote,
    saveJournalEntryMemories,
    setMemoryStorageAdapter,
} from '../../services/memory/localMemory';
import type {
    JournalEntry,
    StorageAdapter,
} from '../../services/journal/journalStorage.types';

function createMemoryAdapter(): StorageAdapter {
    const store = new Map<string, string>();
    return {
        getItem: (key) => Promise.resolve(store.get(key) ?? null),
        setItem: (key, value) => {
            store.set(key, value);
            return Promise.resolve();
        },
        removeItem: (key) => {
            store.delete(key);
            return Promise.resolve();
        },
    };
}

function buildEntry(status: JournalEntry['status'] = 'completed'): JournalEntry {
    return {
        id: 'entry-1',
        title: 'Career pressure and rest',
        emoji: '📝',
        status,
        createdAt: 1_800_000,
        updatedAt: 1_800_000,
        messages: [{
            id: 'message-1',
            role: 'user',
            content: 'I felt career pressure today and wanted a slower evening.',
            timestamp: 1_800_000,
        }],
        analysis: {
            insight: 'The user is balancing ambition with recovery.',
            quote: 'Rest can hold ambition without dropping it.',
            mood: 'Tired but hopeful',
            topics: ['Career', 'Rest'],
            generatedAt: 1_800_100,
        },
    };
}

describe('localMemory', () => {
    beforeEach(() => {
        jest.spyOn(Date, 'now').mockReturnValue(1_900_000);
        setMemoryStorageAdapter(createMemoryAdapter());
    });

    afterEach(() => {
        jest.restoreAllMocks();
        resetMemoryStorageAdapter();
    });

    it('turns completed journal entries into layered local memories', async () => {
        await saveJournalEntryMemories(buildEntry());

        const atoms = await listMemoryAtoms();
        const layers = atoms.map((atom) => atom.layer);

        expect(layers).toEqual(expect.arrayContaining(['episodic', 'profile', 'semantic']));
        expect(atoms.some((atom) => atom.title === 'Theme: Career')).toBe(true);
    });

    it('builds a bounded prompt capsule and records retrieval access', async () => {
        await saveJournalEntryMemories(buildEntry());

        const context = await buildLocalMemoryContext({ query: 'career recovery', limit: 3 });
        const atoms = await listMemoryAtoms();

        expect(context).toContain('## Local Memory Capsule');
        expect(context).toContain('Career');
        expect(atoms.some((atom) => atom.accessCount > 0)).toBe(true);
    });

    it('does not save unfinished drafts as long-term memory', async () => {
        await saveJournalEntryMemories(buildEntry('draft'));

        await expect(listMemoryAtoms()).resolves.toEqual([]);
        await clearMemoryAtoms();
    });

    it('saves and deletes manual note memories', async () => {
        const note = await saveManualMemoryNote('Remember that evenings should stay gentle.');

        expect(note.layer).toBe('note');
        expect(note.source).toBe('manual');
        await expect(deleteMemoryAtom(note.id)).resolves.toBe(true);
        await expect(listMemoryAtoms()).resolves.toEqual([]);
    });
});
