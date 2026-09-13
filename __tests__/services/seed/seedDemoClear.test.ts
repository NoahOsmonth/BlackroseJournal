/* eslint-disable import/first */

const mockStore = new Map<string, string>();
let mockWriteObserver: ((key: string, value: string) => void) | null = null;

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(async (key: string) => mockStore.get(key) ?? null),
        setItem: jest.fn(async (key: string, value: string) => {
            mockStore.set(key, value);
            mockWriteObserver?.(key, value);
        }),
        removeItem: jest.fn(async (key: string) => {
            mockStore.delete(key);
        }),
    },
}));

jest.mock('../../../services/supabase/syncQueue', () => ({
    removeSyncTasksForTable: jest.fn(() => Promise.resolve()),
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
    seedDemoData,
    setDemoSeedEnabledForTests,
} from '../../../services/seed/seedDemoData';
import { createEntry, listEntries } from '../../../services/journal/journalStorage';
import { listMemoryFiles, listTmpFiles, stageTmpMemory } from '../../../services/memory/memoryFiles';
import { activateAccount, clearActiveAccount } from '../../../services/account/accountRuntime';
import { getAccountScopedStorageKey } from '../../../services/account/accountScopedStorage';

function seedStorageValue(key: string): string | undefined {
    return mockStore.get(getAccountScopedStorageKey(key));
}

describe('seedDemoData clear + ledger', () => {
    beforeEach(async () => {
        mockStore.clear();
        mockWriteObserver = null;
        setDemoSeedEnabledForTests(true);
        delete process.env.EXPO_PUBLIC_NANO_GPT_API_KEY;
        delete process.env.EXPO_PUBLIC_NANO_GPT_API_BASE_URL;
        await activateAccount('seed-user');
    });

    afterEach(async () => {
        await clearActiveAccount();
        setDemoSeedEnabledForTests(null);
    });

    it('records each check-in id in the ledger before the row that stages its memory file', async () => {
        // The staged memory file is named after the check-in row id, so an
        // interruption between the row write and the ledger write would leave a
        // staged file no clear can match. Only write order proves the invariant.
        const recordWriteAt = new Map<string, number>();
        const checkInRowWriteAt = new Map<string, number>();
        const ledgerKey = getAccountScopedStorageKey(DEMO_SEED_RECORD_KEY);
        const checkInsKey = getAccountScopedStorageKey('@intention_checkins');
        let writeIndex = 0;

        mockWriteObserver = (key, value) => {
            writeIndex += 1;
            if (key === ledgerKey) {
                const doc = JSON.parse(value) as { checkInIds?: string[] };
                for (const id of doc.checkInIds ?? []) {
                    if (!recordWriteAt.has(id)) recordWriteAt.set(id, writeIndex);
                }
                return;
            }
            if (key === checkInsKey) {
                const rows = JSON.parse(value) as Record<string, unknown>;
                for (const id of Object.keys(rows)) {
                    if (!checkInRowWriteAt.has(id)) checkInRowWriteAt.set(id, writeIndex);
                }
            }
        };

        try {
            await seedDemoData();
        } finally {
            mockWriteObserver = null;
        }

        expect(checkInRowWriteAt.size).toBeGreaterThan(0);
        for (const [id, rowWrite] of checkInRowWriteAt) {
            expect(recordWriteAt.get(id)).toBeLessThan(rowWrite);
        }

        // And every staged file is therefore clearable by the ledger.
        const record = JSON.parse(seedStorageValue(DEMO_SEED_RECORD_KEY) ?? '{}') as { checkInIds?: string[] };
        const recorded = new Set(record.checkInIds ?? []);
        expect(recorded.size).toBe((record.checkInIds ?? []).length);
        const staged = await listTmpFiles();
        expect(staged.length).toBeGreaterThan(0);
        expect(staged.filter((header) => header.sourceSessionKey && !recorded.has(header.sourceSessionKey))).toEqual([]);
    });

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

        // Seeded completed check-ins stage offline memory files; a file staged
        // from a live user session must survive the demo clear.
        const realStaged = await stageTmpMemory({
            type: 'project',
            name: 'Real thread',
            description: 'Thread hint general. real',
            body: '## Current Stage\nA real journal entry.',
            sourceSessionKey: real.id,
        });
        const stagedFromSeed = await listMemoryFiles({ limit: 50 });
        expect(stagedFromSeed.length).toBeGreaterThan(1);

        const cleared = await clearDemoData();
        expect(cleared).toBe(true);

        const remainingFiles = await listMemoryFiles({ limit: 50 });
        expect(remainingFiles.map((h) => h.id)).toEqual([realStaged.id]);

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
