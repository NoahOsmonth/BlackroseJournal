/**
 * Journal Storage Service Tests
 * Tests CRUD operations with mock storage adapter
 */

// Mock AsyncStorage before importing any modules that use it
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
}));

jest.mock('../services/supermemory', () => ({
    ingestJournalEntry: jest.fn().mockResolvedValue(undefined),
}));

import { Message } from '../services/ai';
import {
    clearAllEntries,
    createEntry,
    deleteEntry,
    getEntry,
    listCompleted,
    listDrafts,
    listEntries,
    resetStorageAdapter,
    setStorageAdapter,
    updateEntry,
} from '../services/journalStorage';
import { StorageAdapter } from '../services/journalStorage.types';

// Mock storage implementation for testing
function createMockStorage(): StorageAdapter & { data: Record<string, string> } {
    const data: Record<string, string> = {};
    return {
        data,
        getItem: jest.fn(async (key: string) => data[key] || null),
        setItem: jest.fn(async (key: string, value: string) => {
            data[key] = value;
        }),
        removeItem: jest.fn(async (key: string) => {
            delete data[key];
        }),
    };
}

const mockMessages: Message[] = [
    { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
    { id: '2', role: 'assistant', content: 'Hi there!', timestamp: Date.now() },
];

describe('journalStorage', () => {
    let mockStorage: ReturnType<typeof createMockStorage>;

    beforeEach(() => {
        mockStorage = createMockStorage();
        setStorageAdapter(mockStorage);
    });

    afterEach(() => {
        resetStorageAdapter();
    });

    describe('createEntry', () => {
        it('creates a new entry with generated ID', async () => {
            const entry = await createEntry({
                messages: mockMessages,
                status: 'draft',
            });

            expect(entry.id).toMatch(/^entry_\d+_[a-z0-9]+$/);
            expect(entry.title).toBe('Untitled');
            expect(entry.emoji).toBe('📝');
            expect(entry.status).toBe('draft');
            expect(entry.messages).toEqual(mockMessages);
            expect(entry.createdAt).toBeDefined();
            expect(entry.updatedAt).toBeDefined();
        });

        it('creates entry with custom title and emoji', async () => {
            const entry = await createEntry({
                title: 'My Journal',
                emoji: '🎉',
                messages: mockMessages,
                status: 'completed',
            });

            expect(entry.title).toBe('My Journal');
            expect(entry.emoji).toBe('🎉');
            expect(entry.status).toBe('completed');
        });

        it('persists entry to storage', async () => {
            await createEntry({
                messages: mockMessages,
                status: 'draft',
            });

            expect(mockStorage.setItem).toHaveBeenCalled();
        });
    });

    describe('getEntry', () => {
        it('returns entry by ID', async () => {
            const created = await createEntry({
                title: 'Test Entry',
                messages: mockMessages,
                status: 'completed',
            });

            const retrieved = await getEntry(created.id);

            expect(retrieved).not.toBeNull();
            expect(retrieved?.title).toBe('Test Entry');
        });

        it('returns null for non-existent ID', async () => {
            const entry = await getEntry('non-existent-id');
            expect(entry).toBeNull();
        });
    });

    describe('updateEntry', () => {
        it('updates entry fields', async () => {
            const created = await createEntry({
                messages: mockMessages,
                status: 'draft',
            });

            const updated = await updateEntry(created.id, {
                title: 'Updated Title',
                emoji: '😊',
                status: 'completed',
            });

            expect(updated).not.toBeNull();
            expect(updated?.title).toBe('Updated Title');
            expect(updated?.emoji).toBe('😊');
            expect(updated?.status).toBe('completed');
            expect(updated?.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
        });

        it('updates messages array', async () => {
            const created = await createEntry({
                messages: mockMessages,
                status: 'draft',
            });

            const newMessages: Message[] = [
                ...mockMessages,
                { id: '3', role: 'user', content: 'New message', timestamp: Date.now() },
            ];

            const updated = await updateEntry(created.id, { messages: newMessages });

            expect(updated?.messages).toHaveLength(3);
        });

        it('returns null for non-existent ID', async () => {
            const result = await updateEntry('non-existent', { title: 'Test' });
            expect(result).toBeNull();
        });
    });

    describe('deleteEntry', () => {
        it('deletes entry and returns true', async () => {
            const created = await createEntry({
                messages: mockMessages,
                status: 'draft',
            });

            const deleted = await deleteEntry(created.id);
            expect(deleted).toBe(true);

            const retrieved = await getEntry(created.id);
            expect(retrieved).toBeNull();
        });

        it('returns false for non-existent ID', async () => {
            const result = await deleteEntry('non-existent');
            expect(result).toBe(false);
        });
    });

    describe('listEntries', () => {
        beforeEach(async () => {
            await createEntry({ messages: mockMessages, status: 'draft' });
            await createEntry({ messages: mockMessages, status: 'completed' });
            await createEntry({ messages: mockMessages, status: 'draft' });
        });

        it('returns all entries', async () => {
            const entries = await listEntries();
            expect(entries).toHaveLength(3);
        });

        it('filters by status', async () => {
            const drafts = await listEntries('draft');
            expect(drafts).toHaveLength(2);
            drafts.forEach((e) => expect(e.status).toBe('draft'));

            const completed = await listEntries('completed');
            expect(completed).toHaveLength(1);
            completed.forEach((e) => expect(e.status).toBe('completed'));
        });

        it('returns entries sorted by updatedAt descending', async () => {
            const entries = await listEntries();
            for (let i = 1; i < entries.length; i++) {
                expect(entries[i - 1].updatedAt).toBeGreaterThanOrEqual(entries[i].updatedAt);
            }
        });
    });

    describe('listDrafts', () => {
        it('returns only draft entries', async () => {
            await createEntry({ messages: mockMessages, status: 'draft' });
            await createEntry({ messages: mockMessages, status: 'completed' });

            const drafts = await listDrafts();
            expect(drafts).toHaveLength(1);
            expect(drafts[0].status).toBe('draft');
        });
    });

    describe('listCompleted', () => {
        it('returns only completed entries', async () => {
            await createEntry({ messages: mockMessages, status: 'draft' });
            await createEntry({ messages: mockMessages, status: 'completed' });

            const completed = await listCompleted();
            expect(completed).toHaveLength(1);
            expect(completed[0].status).toBe('completed');
        });
    });

    describe('clearAllEntries', () => {
        it('removes all entries from storage', async () => {
            await createEntry({ messages: mockMessages, status: 'draft' });
            await createEntry({ messages: mockMessages, status: 'completed' });

            await clearAllEntries();

            const entries = await listEntries();
            expect(entries).toHaveLength(0);
        });
    });
});
