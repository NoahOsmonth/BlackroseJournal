// Mock AsyncStorage first
jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@/services/supermemory', () => ({
    ingestJournalEntry: jest.fn().mockResolvedValue(undefined),
}));

import {
    clearAllEntries,
    createEntry,
    getAllEntriesForExport,
    setStorageAdapter
} from '@/services/journalStorage';
import { StorageAdapter } from '@/services/journalStorage.types';

describe('Journal Storage Data Management', () => {
    let mockStore: Record<string, string> = {};

    const mockAdapter: StorageAdapter = {
        getItem: jest.fn(async (key) => mockStore[key] || null),
        setItem: jest.fn(async (key, value) => { mockStore[key] = value; }),
        removeItem: jest.fn(async (key) => { delete mockStore[key]; }),
    };

    beforeAll(() => {
        setStorageAdapter(mockAdapter);
    });

    beforeEach(async () => {
        mockStore = {};
        jest.clearAllMocks();
        // Setup some data
        await createEntry({ title: 'Test 1', messages: [], status: 'completed', emoji: 'A' });
        await createEntry({ title: 'Test 2', messages: [], status: 'draft', emoji: 'B' });
    });

    describe('clearAllEntries', () => {
        it('should remove all entries from storage', async () => {
            await clearAllEntries();
            expect(mockAdapter.removeItem).toHaveBeenCalledWith('@journal_entries');
            expect(mockStore['@journal_entries']).toBeUndefined();
        });
    });

    describe('getAllEntriesForExport', () => {
        it('should return a JSON string of all entries', async () => {
            const exportData = await getAllEntriesForExport();
            const parsed = JSON.parse(exportData);

            expect(Array.isArray(parsed)).toBe(true);
            expect(parsed.length).toBe(2);
            expect(parsed[0]).toHaveProperty('id');
            expect(parsed[0]).toHaveProperty('title');
            // Should verify sort order or content, but length/structure is good start
            expect(parsed.some((e: any) => e.title === 'Test 1')).toBe(true);
            expect(parsed.some((e: any) => e.title === 'Test 2')).toBe(true);
        });

        it('should return empty array string if no entries', async () => {
            await clearAllEntries();
            const exportData = await getAllEntriesForExport();
            expect(exportData).toBe('[]');
        });
    });
});