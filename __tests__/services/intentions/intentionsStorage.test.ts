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

jest.mock('../../../services/memory/sessionDigestBuild', () => ({
    buildAndSaveSessionDigest: jest.fn(async () => null),
}));

jest.mock('../../../services/memory/identityExtraction', () => ({
    extractIdentityFromSessionTranscript: jest.fn(async () => null),
}));

jest.mock('../../../services/memory/hindsight/hindsightRetain', () => ({
    retainCheckInToHindsight: jest.fn(async () => true),
}));

import {
    createCheckIn,
    updateCheckIn,
    clearAllCheckIns,
    listCheckIns,
    migrateLegacyIntentionsToActiveAccount,
} from '../../../services/intentions/intentionsStorage';
import { retainCheckInToHindsight } from '../../../services/memory/hindsight/hindsightRetain';
import {
    listMemoryAtoms,
    resetMemoryStorageAdapter,
    setMemoryStorageAdapter,
} from '../../../services/memory/localMemory';
import type { StorageAdapter } from '../../../services/journal/journalStorage.types';
import { activateAccount, clearActiveAccount } from '../../../services/account/accountRuntime';

const mockedRetain = retainCheckInToHindsight as jest.MockedFunction<
    typeof retainCheckInToHindsight
>;

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
    beforeEach(async () => {
        mockAsyncStorageStore.clear();
        setMemoryStorageAdapter(createMemoryAdapter());
        mockedRetain.mockClear();
        // Clear the direct AI key so a live .env EXPO_PUBLIC_NANO_GPT_API_KEY
        // cannot make saveIntentionCheckInMemories hit the real AI provider
        // (extractCheckInMemoryAtoms is not mocked here) and hang the suite.
        delete process.env.EXPO_PUBLIC_NANO_GPT_API_KEY;
        delete process.env.EXPO_PUBLIC_NANO_GPT_API_BASE_URL;
        await activateAccount('test-account');
    });

    afterEach(async () => {
        await clearActiveAccount();
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

    it('retains a completed check-in to hindsight on create', async () => {
        await createCheckIn({
            type: 'morning',
            title: 'Morning check-in',
            summary: 'Summary.',
            mood: 'Reflective',
            status: 'completed',
            messages: [],
        });

        expect(mockedRetain).toHaveBeenCalledTimes(1);
    });

    it('does not retain draft check-ins', async () => {
        await createCheckIn({
            type: 'evening',
            title: 'Evening draft',
            summary: 'Draft summary.',
            mood: 'Reflective',
            status: 'draft',
            messages: [],
        });

        expect(mockedRetain).not.toHaveBeenCalled();
    });

    it('retains when a draft is updated to completed', async () => {
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
            messages: [],
        });

        expect(mockedRetain).toHaveBeenCalledTimes(1);
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

    it('isolates check-ins and claims legacy intention stores idempotently', async () => {
        mockAsyncStorageStore.set('@intention_checkins', JSON.stringify({
            legacy: {
                id: 'legacy',
                type: 'morning',
                title: 'Legacy check-in',
                summary: '',
                mood: 'Reflective',
                messages: [],
                status: 'draft',
                createdAt: 1,
                updatedAt: 1,
            },
        }));

        await migrateLegacyIntentionsToActiveAccount();
        await expect(listCheckIns()).resolves.toEqual([
            expect.objectContaining({ id: 'legacy' }),
        ]);

        await activateAccount('other-account');
        await expect(listCheckIns()).resolves.toEqual([]);
    });
});
