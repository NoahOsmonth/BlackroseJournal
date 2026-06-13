/* eslint-disable import/first */

const mockAsyncStorageStore = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn((key: string) => Promise.resolve(mockAsyncStorageStore.get(key) ?? null)),
        setItem: jest.fn((key: string, value: string) => {
            mockAsyncStorageStore.set(key, value);
            return Promise.resolve();
        }),
        removeItem: jest.fn((key: string) => {
            mockAsyncStorageStore.delete(key);
            return Promise.resolve();
        }),
    },
}));

jest.mock('../../../services/intentions/intentionsRemote', () => ({
    fetchRemoteCheckIns: jest.fn(() => Promise.resolve(null)),
    fetchRemoteIntentions: jest.fn(() => Promise.resolve(null)),
    mergeCheckIns: jest.fn((local: object) => local),
    mergeIntentions: jest.fn((local: object) => local),
    pushCheckIns: jest.fn(() => Promise.resolve(false)),
    pushIntentions: jest.fn(() => Promise.resolve(false)),
    queueCheckInDelete: jest.fn(() => Promise.resolve()),
    queueCheckInUpsert: jest.fn(() => Promise.resolve()),
    queueIntentionDelete: jest.fn(() => Promise.resolve()),
    queueIntentionUpsert: jest.fn(() => Promise.resolve()),
}));

import {
    createCheckIn,
    updateCheckIn,
    clearAllCheckIns,
    listCheckIns,
} from '../../../services/intentions/intentionsStorage';
import {
    listMemoryAtoms,
    resetMemoryStorageAdapter,
    setMemoryStorageAdapter,
} from '../../../services/memory/localMemory';
import type { StorageAdapter } from '../../../services/journal/journalStorage.types';

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

describe('intentionsStorage', () => {
    beforeEach(() => {
        mockAsyncStorageStore.clear();
        setMemoryStorageAdapter(createMemoryAdapter());
    });

    afterEach(() => {
        resetMemoryStorageAdapter();
    });

    it('saves memory atoms when creating a completed check-in', async () => {
        await createCheckIn({
            type: 'morning',
            title: 'Start with focus',
            summary: 'I want to stay focused today.',
            mood: 'Reflective',
            status: 'completed',
            messages: [{
                id: 'msg-1',
                role: 'user',
                content: 'I want to stay focused today.',
                timestamp: 1_000_000,
            }],
        });

        const atoms = await listMemoryAtoms();
        expect(atoms.some((atom) => atom.source === 'intention')).toBe(true);
        expect(atoms.some((atom) => atom.layer === 'episodic')).toBe(true);
    });

    it('does not save memory atoms for draft check-ins', async () => {
        await createCheckIn({
            type: 'evening',
            title: 'Evening draft',
            summary: 'Draft summary.',
            mood: 'Reflective',
            status: 'draft',
            messages: [],
        });

        await expect(listMemoryAtoms()).resolves.toEqual([]);
    });

    it('saves memory atoms when a draft is updated to completed', async () => {
        const draft = await createCheckIn({
            type: 'intention',
            title: 'Intention draft',
            summary: 'Draft summary.',
            mood: 'Reflective',
            status: 'draft',
            messages: [],
        });

        await updateCheckIn(draft.id, {
            status: 'completed',
            messages: [{
                id: 'msg-2',
                role: 'user',
                content: 'I commit to walking daily.',
                timestamp: 2_000_000,
            }],
        });

        const atoms = await listMemoryAtoms();
        expect(atoms.some((atom) => atom.source === 'intention')).toBe(true);
    });

    it('clears all check-ins', async () => {
        await createCheckIn({
            type: 'morning',
            title: 'Morning check-in',
            summary: 'Summary.',
            mood: 'Reflective',
            status: 'completed',
            messages: [],
        });

        await clearAllCheckIns();

        await expect(listCheckIns()).resolves.toEqual([]);
    });
});
