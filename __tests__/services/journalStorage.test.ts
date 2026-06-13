/* eslint-disable import/first */

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
    },
}));

jest.mock('../../services/journal/journalRemote', () => ({
    JOURNAL_TABLE: 'journal_entries',
    deleteRemoteJournalEntries: jest.fn(() => Promise.resolve(true)),
    fetchRemoteJournalEntries: jest.fn(() => Promise.resolve(null)),
    mergeEntries: jest.fn((local: object) => local),
    pushJournalEntries: jest.fn(() => Promise.resolve(false)),
    queueJournalEntryDelete: jest.fn(() => Promise.resolve()),
    queueJournalEntryUpsert: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../services/supabase/syncQueue', () => ({
    removeSyncTasksForTable: jest.fn(() => Promise.resolve()),
}));

import {
    clearAllEntries,
    createEntry,
    getEntry,
    listEntries,
    resetStorageAdapter,
    setStorageAdapter,
} from '../../services/journal/journalStorage';
import type { StorageAdapter } from '../../services/journal/journalStorage.types';
import { deleteRemoteJournalEntries } from '../../services/journal/journalRemote';
import { removeSyncTasksForTable } from '../../services/supabase/syncQueue';

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

describe('journalStorage analysis', () => {
    beforeEach(() => {
        setStorageAdapter(createMemoryAdapter());
    });

    afterEach(() => {
        resetStorageAdapter();
    });

    it('persists generated analysis alongside completed entry messages', async () => {
        const entry = await createEntry({
            title: 'Morning',
            emoji: 'sun',
            status: 'completed',
            messages: [{
                id: 'message-1',
                role: 'user',
                content: 'I want a slower morning.',
                timestamp: 0,
            }],
            analysis: {
                insight: 'You are asking for more space.',
                quote: 'A slower start can steady the day.',
                mood: 'Hopeful',
                topics: ['Morning', 'Rest'],
                generatedAt: 1,
            },
        });

        const saved = await getEntry(entry.id);

        expect(saved?.analysis?.insight).toBe('You are asking for more space.');
        expect(saved?.analysis?.topics).toEqual(['Morning', 'Rest']);
    });

    it('clearAllEntries removes local entries, deletes remote rows, and clears pending sync tasks', async () => {
        const entryA = await createEntry({
            title: 'A',
            status: 'completed',
            messages: [{ id: 'm1', role: 'user', content: 'a', timestamp: 1 }],
        });
        const entryB = await createEntry({
            title: 'B',
            status: 'completed',
            messages: [{ id: 'm2', role: 'user', content: 'b', timestamp: 2 }],
        });

        await clearAllEntries();

        await expect(listEntries()).resolves.toEqual([]);
        expect(deleteRemoteJournalEntries).toHaveBeenCalledWith(
            expect.arrayContaining([entryA.id, entryB.id])
        );
        expect(removeSyncTasksForTable).toHaveBeenCalledWith('journal_entries');
    });
});
