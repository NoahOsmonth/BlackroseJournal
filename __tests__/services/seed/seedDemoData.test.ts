/* eslint-disable import/first */

const mockStore = new Map<string, string>();
type Deferred = { promise: Promise<void>; resolve: () => void };
let mockDelayedReadKey: string | null = null;
let mockDelayedRead: Deferred | null = null;
let mockDelayedReadStarted: (() => void) | null = null;

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(async (key: string) => {
            if (key === mockDelayedReadKey && mockDelayedRead) {
                mockDelayedReadStarted?.();
                await mockDelayedRead.promise;
            }
            return mockStore.get(key) ?? null;
        }),
        setItem: jest.fn(async (key: string, value: string) => {
            mockStore.set(key, value);
        }),
        removeItem: jest.fn(async (key: string) => {
            mockStore.delete(key);
        }),
    },
}));

jest.mock('../../../services/journal/journalRemote', () => ({
    JOURNAL_TABLE: 'journal_entries',
    deleteRemoteJournalEntries: jest.fn(() => Promise.resolve(true)),
    fetchRemoteJournalEntries: jest.fn(() => Promise.resolve(null)),
    mergeEntries: jest.fn((local: object) => local),
    pushJournalEntries: jest.fn(() => Promise.resolve(false)),
    queueJournalEntryDelete: jest.fn(() => Promise.resolve()),
    queueJournalEntryUpsert: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../../services/supabase/syncQueue', () => ({
    removeSyncTasksForTable: jest.fn(() => Promise.resolve()),
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

jest.mock('../../../services/goals/goalsRemote', () => ({
    fetchRemoteGoals: jest.fn(() => Promise.resolve(null)),
    mergeGoals: jest.fn((local: object) => local),
    pushGoals: jest.fn(() => Promise.resolve(false)),
    queueGoalDelete: jest.fn(() => Promise.resolve()),
    queueGoalUpsert: jest.fn(() => Promise.resolve()),
}));

import {
    DEMO_SEED_RECORD_KEY,
    SEED_FLAG_KEY,
    clearDemoData,
    isDemoSeedEnabled,
    seedBulkProbeJournal,
    seedDemoData,
    seedDemoDataIfFirstLaunch,
    setDemoSeedEnabledForTests,
} from '../../../services/seed/seedDemoData';
import { createEntry, listEntries } from '../../../services/journal/journalStorage';
import { listCheckIns, listIntentions } from '../../../services/intentions/intentionsStorage';
import { listGoals } from '../../../services/goals/goalsStorage';
import { listMemoryAtoms } from '../../../services/memory/localMemory';
import { getLocalDateKey } from '../../../utils/date';
import { activateAccount, clearActiveAccount } from '../../../services/account/accountRuntime';
import {
    getAccountScopedStorageKey,
    getAccountScopedStorageKeyForAccount,
} from '../../../services/account/accountScopedStorage';

function seedStorageValue(key: string): string | undefined {
    return mockStore.get(getAccountScopedStorageKey(key));
}

function deferred(): Deferred {
    let resolve!: () => void;
    const promise = new Promise<void>((nextResolve) => { resolve = nextResolve; });
    return { promise, resolve };
}

describe('seedDemoData', () => {
    beforeEach(async () => {
        mockStore.clear();
        mockDelayedReadKey = null;
        mockDelayedRead = null;
        mockDelayedReadStarted = null;
        setDemoSeedEnabledForTests(true);
        await activateAccount('seed-user');
    });

    afterEach(async () => {
        await clearActiveAccount();
        setDemoSeedEnabledForTests(null);
    });

    it('populates a coherent, internally consistent dataset', async () => {
        await seedDemoData();

        const entries = await listEntries();
        const intentions = await listIntentions();
        const checkIns = await listCheckIns();
        const goals = await listGoals();
        const atoms = await listMemoryAtoms();

        expect(entries).toHaveLength(5);
        expect(entries.every((entry) => entry.status === 'completed')).toBe(true);
        expect(intentions).toHaveLength(4);
        expect(checkIns).toHaveLength(6);
        expect(goals).toHaveLength(12);

        const sources = new Set(atoms.map((atom) => atom.source));
        expect(sources.has('journal')).toBe(true);
        expect(sources.has('manual')).toBe(true);

        expect(atoms.every((atom) => atom.title.toLowerCase() !== 'about the user')).toBe(true);
    });

    it('is safe to run repeatedly without duplicating seed rows', async () => {
        await seedDemoData();
        await seedDemoData();

        expect(await listEntries()).toHaveLength(5);
        expect(await listIntentions()).toHaveLength(4);
        expect(await listCheckIns()).toHaveLength(6);
        expect(await listGoals()).toHaveLength(12);
    });

    it('includes Sunday-reset family lunch and argument-looping demo journals', async () => {
        await seedDemoData();
        const titles = (await listEntries()).map((e) => e.title);
        expect(titles).toEqual(expect.arrayContaining([
            'Sunday reset with the family',
            'The argument that kept looping',
        ]));
    });

    /**
     * createdAt offset: seed daysBack spreads entry write days.
     * Break by: createEntry ignoring input.createdAt.
     */
    it('lands seeded journal entries on distinct past days per daysAgo', async () => {
        await seedDemoData();
        const entries = await listEntries();
        const dateKeys = new Set(
            entries.map((e) => getLocalDateKey(new Date(e.createdAt))),
        );
        // daysBack 0,2,4,6,9 → at least 4 distinct local days
        expect(dateKeys.size).toBeGreaterThanOrEqual(4);
        expect(dateKeys.has(getLocalDateKey(new Date()))).toBe(true);
    });

    /**
     * Production gate: auto-seed no-op when demo seed disabled.
     * Sabotage: remove isDemoSeedEnabled check in seedDemoDataIfFirstLaunch.
     */
    it('auto-seed is a no-op when demo seed flag is false', async () => {
        setDemoSeedEnabledForTests(false);
        expect(isDemoSeedEnabled()).toBe(false);
        const did = await seedDemoDataIfFirstLaunch();
        expect(did).toBe(false);
        expect(await listEntries()).toHaveLength(0);
        expect(seedStorageValue(SEED_FLAG_KEY)).toBeUndefined();
    });

    it('seedBulkProbeJournal writes N tracked entries clearable via clearDemoData', async () => {
        const n = await seedBulkProbeJournal({ count: 3 });
        expect(n).toBe(3);
        expect(await listEntries()).toHaveLength(3);
        expect(seedStorageValue(DEMO_SEED_RECORD_KEY)).toBeTruthy();
        const cleared = await clearDemoData();
        expect(cleared).toBe(true);
        expect(await listEntries()).toHaveLength(0);
    });

    it('seedBulkProbeJournal throws when demo seed is disabled', async () => {
        setDemoSeedEnabledForTests(false);
        await expect(seedBulkProbeJournal({ count: 2 })).rejects.toThrow(/__DEV__/);
    });

    it('aborts an in-flight seed before it can continue under another account', async () => {
        const accountARecordKey = getAccountScopedStorageKeyForAccount(
            DEMO_SEED_RECORD_KEY,
            'seed-account-a',
        );
        const releaseRead = deferred();
        const readStarted = deferred();
        mockDelayedReadKey = accountARecordKey;
        mockDelayedRead = releaseRead;
        mockDelayedReadStarted = readStarted.resolve;

        await activateAccount('seed-account-a');
        const pending = seedDemoData();
        await readStarted.promise;
        const switching = activateAccount('seed-account-b');
        releaseRead.resolve();

        await expect(pending).rejects.toThrow('Account operation was aborted');
        await switching;
        expect(mockStore.has(getAccountScopedStorageKeyForAccount(
            DEMO_SEED_RECORD_KEY,
            'seed-account-b',
        ))).toBe(false);
        expect(mockStore.has(getAccountScopedStorageKeyForAccount(
            SEED_FLAG_KEY,
            'seed-account-b',
        ))).toBe(false);
    });

    it('aborts an in-flight clear instead of deleting with a stale account context', async () => {
        const accountARecordKey = getAccountScopedStorageKeyForAccount(
            DEMO_SEED_RECORD_KEY,
            'seed-account-a',
        );
        mockStore.set(accountARecordKey, JSON.stringify({
            schemaVersion: 1,
            journalEntryIds: [],
            intentionIds: [],
            checkInIds: [],
            goalIds: [],
            memoryAtomIds: [],
        }));
        const releaseRead = deferred();
        const readStarted = deferred();
        mockDelayedReadKey = accountARecordKey;
        mockDelayedRead = releaseRead;
        mockDelayedReadStarted = readStarted.resolve;

        await activateAccount('seed-account-a');
        const pending = clearDemoData();
        await readStarted.promise;
        const switching = activateAccount('seed-account-b');
        releaseRead.resolve();

        await expect(pending).rejects.toThrow('Account operation was aborted');
        await switching;
        expect(mockStore.has(accountARecordKey)).toBe(true);
        expect(mockStore.has(getAccountScopedStorageKeyForAccount(
            DEMO_SEED_RECORD_KEY,
            'seed-account-b',
        ))).toBe(false);
    });

    /**
     * Clear removes only tracked seed IDs; real entry stays; flag reset.
     */
    it('clearDemoData removes seed and keeps a real entry; resets seed flag', async () => {
        await seedDemoData();
        expect(await listEntries()).toHaveLength(5);

        const real = await createEntry({
            title: 'Real user lunch',
            emoji: '🍜',
            status: 'completed',
            messages: [{
                id: 'real_u',
                role: 'user',
                content: 'I ate real ramen with no seed content at all.',
                timestamp: Date.now(),
            }],
        });

        expect(await listEntries()).toHaveLength(6);
        expect(seedStorageValue(SEED_FLAG_KEY)).toBe('true');
        expect(seedStorageValue(DEMO_SEED_RECORD_KEY)).toBeTruthy();

        const cleared = await clearDemoData();
        expect(cleared).toBe(true);

        const remaining = await listEntries();
        expect(remaining).toHaveLength(1);
        expect(remaining[0].id).toBe(real.id);
        expect(remaining[0].title).toBe('Real user lunch');
        expect(seedStorageValue(SEED_FLAG_KEY)).toBeUndefined();
        expect(seedStorageValue(DEMO_SEED_RECORD_KEY)).toBeUndefined();

        // Flag reset allows re-seed
        await seedDemoData();
        expect(await listEntries()).toHaveLength(6); // 5 seed + real
        expect(seedStorageValue(SEED_FLAG_KEY)).toBe('true');
    });
});
