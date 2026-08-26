/* eslint-disable import/first */

jest.mock('../../../services/journal/journalRemote', () => ({
    JOURNAL_TABLE: 'journal_entries',
    deleteRemoteJournalEntries: jest.fn(() => Promise.resolve(true)),
    fetchRemoteJournalEntries: jest.fn(() => Promise.resolve(null)),
    mergeEntries: jest.fn((local: object, remote: object[]) => ({ ...local, ...remote })),
    pushJournalEntries: jest.fn(() => Promise.resolve(false)),
    queueJournalEntryDelete: jest.fn(() => Promise.resolve()),
    queueJournalEntryUpsert: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../../services/supabase/syncQueue', () => ({
    removeSyncTasksForTable: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../../services/memory/dayDigestStorage', () => ({
    upsertJournalDayDigest: jest.fn(async () => undefined),
}));
jest.mock('../../../services/memory/identityExtraction', () => ({
    extractIdentityFromSessionTranscript: jest.fn(async () => undefined),
}));
jest.mock('../../../services/memory/localMemory', () => ({
    saveJournalEntryMemories: jest.fn(async () => undefined),
}));
jest.mock('../../../services/memory/sessionDigestBuild', () => ({
    buildAndSaveSessionDigest: jest.fn(async () => undefined),
}));
jest.mock('../../../services/memory/hindsight/hindsightRetain', () => ({
    retainJournalEntryToHindsight: jest.fn(async () => true),
}));

import {
    clearAllEntries,
    createEntry,
    hasLegacyJournalEntries,
    importJournalEntriesSnapshot,
    listEntries,
    migrateLegacyJournalEntriesToActiveAccount,
    resetStorageAdapter,
    setStorageAdapter,
} from '../../../services/journal/journalStorage';
import { runJournalFinishSideEffects } from '../../../services/journal/journalFinishSideEffects';
import type { StorageAdapter } from '../../../services/journal/journalStorage.types';
import { fetchRemoteJournalEntries, deleteRemoteJournalEntries } from '../../../services/journal/journalRemote';
import { activateAccount, clearActiveAccount } from '../../../services/account/accountRuntime';
import { getAccountScopedStorageKeyForAccount } from '../../../services/account/accountScopedStorage';

function deferred<T = void>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
    return { promise, resolve };
}

function createMemoryAdapter(values: Map<string, string>): StorageAdapter {
    return {
        getItem: async (key) => values.get(key) ?? null,
        setItem: async (key, value) => { values.set(key, value); },
        removeItem: async (key) => { values.delete(key); },
    };
}

function completedEntry(id = 'entry-a') {
    return {
        id,
        title: 'A private entry',
        emoji: '📝',
        messages: [{ id: 'message-1', role: 'user' as const, content: 'A private thought', timestamp: 1 }],
        status: 'completed' as const,
        createdAt: 1,
        updatedAt: 1,
    };
}

describe('journal account-switch races', () => {
    let values: Map<string, string>;
    let adapter: StorageAdapter;

    beforeEach(async () => {
        await clearActiveAccount();
        values = new Map();
        adapter = createMemoryAdapter(values);
        setStorageAdapter(adapter);
        jest.clearAllMocks();
    });

    afterEach(async () => {
        await clearActiveAccount();
        resetStorageAdapter();
    });

    it('rejects a create that resumes after switching accounts instead of writing to B', async () => {
        const started = deferred<void>();
        const release = deferred<void>();
        const accountAKey = getAccountScopedStorageKeyForAccount('@journal_entries', 'account-a');
        let delayed = false;
        adapter = {
            ...adapter,
            getItem: async (key) => {
                if (key === accountAKey && !delayed) {
                    delayed = true;
                    started.resolve();
                    await release.promise;
                }
                return values.get(key) ?? null;
            },
        };
        setStorageAdapter(adapter);
        await activateAccount('account-a');

        const pending = createEntry({ status: 'draft', messages: [], title: 'A only' });
        await started.promise;
        const switching = activateAccount('account-b');
        release.resolve();

        await expect(pending).rejects.toThrow('Account operation was aborted');
        await switching;
        expect(values.has(getAccountScopedStorageKeyForAccount('@journal_entries', 'account-b'))).toBe(false);
    });

    it('rejects a stale remote list instead of saving or returning its rows after switching', async () => {
        const remote = deferred<ReturnType<typeof completedEntry>[]>();
        jest.mocked(fetchRemoteJournalEntries).mockReturnValue(remote.promise);
        await activateAccount('account-a');

        const pending = listEntries();
        while (jest.mocked(fetchRemoteJournalEntries).mock.calls.length === 0) await Promise.resolve();
        const switching = activateAccount('account-b');
        remote.resolve([completedEntry()]);

        await expect(pending).rejects.toThrow('Account operation was aborted');
        await switching;
        expect(values.has(getAccountScopedStorageKeyForAccount('@journal_entries', 'account-b'))).toBe(false);
    });

    it('rejects a clear whose remote delete resumes after switching instead of clearing B', async () => {
        const release = deferred<void>();
        await activateAccount('account-a');
        await createEntry({ status: 'completed', messages: [], title: 'A only' });
        jest.mocked(deleteRemoteJournalEntries).mockReturnValueOnce(release.promise.then(() => true));

        const pending = clearAllEntries();
        while (jest.mocked(deleteRemoteJournalEntries).mock.calls.length === 0) await Promise.resolve();
        const switching = activateAccount('account-b');
        release.resolve();

        await expect(pending).rejects.toThrow('Account operation was aborted');
        await switching;
        expect(values.has(getAccountScopedStorageKeyForAccount('@journal_entries', 'account-b'))).toBe(false);
    });

    it('rejects an import that completes after switching instead of reporting success to B', async () => {
        const release = deferred<void>();
        const setStarted = deferred<void>();
        adapter = {
            ...adapter,
            setItem: async (key, value) => {
                setStarted.resolve();
                await release.promise;
                values.set(key, value);
            },
        };
        setStorageAdapter(adapter);
        await activateAccount('account-a');

        const pending = importJournalEntriesSnapshot(JSON.stringify({ imported: completedEntry() }));
        await setStarted.promise;
        const switching = activateAccount('account-b');
        release.resolve();

        await expect(pending).rejects.toThrow('Account operation was aborted');
        await switching;
        expect(values.has(getAccountScopedStorageKeyForAccount('@journal_entries', 'account-b'))).toBe(false);
    });

    it('rejects legacy inspection after switching instead of returning a stale result', async () => {
        const started = deferred<void>();
        const release = deferred<void>();
        adapter = {
            ...adapter,
            getItem: async (key) => {
                if (key === '@journal_entries') {
                    started.resolve();
                    await release.promise;
                }
                return values.get(key) ?? null;
            },
        };
        values.set('@journal_entries', JSON.stringify({ legacy: completedEntry('legacy') }));
        setStorageAdapter(adapter);
        await activateAccount('account-a');

        const pending = hasLegacyJournalEntries();
        await started.promise;
        const switching = activateAccount('account-b');
        release.resolve();

        await expect(pending).rejects.toThrow('Account operation was aborted');
        await switching;
    });

    it('keeps ordinary remote failures soft for list reads', async () => {
        jest.mocked(fetchRemoteJournalEntries).mockRejectedValueOnce(new Error('offline'));
        await activateAccount('account-a');

        await expect(listEntries()).resolves.toEqual([]);
    });

    it('stops finish side effects after the account lease is aborted', async () => {
        const release = deferred<void>();
        const started = deferred<void>();
        const { saveJournalEntryMemories } = jest.requireMock(
            '../../../services/memory/localMemory',
        ) as { saveJournalEntryMemories: jest.Mock };
        const { upsertJournalDayDigest } = jest.requireMock(
            '../../../services/memory/dayDigestStorage',
        ) as { upsertJournalDayDigest: jest.Mock };
        saveJournalEntryMemories.mockImplementationOnce(async () => {
            started.resolve();
            await release.promise;
        });
        await activateAccount('account-a');

        const pending = runJournalFinishSideEffects(completedEntry());
        await started.promise;
        const switching = activateAccount('account-b');
        release.resolve();

        await expect(pending).rejects.toThrow('Account operation was aborted');
        await switching;
        expect(upsertJournalDayDigest).not.toHaveBeenCalled();
    });

    it('rejects a queued legacy migration that becomes stale before it starts', async () => {
        const started = deferred<void>();
        const release = deferred<void>();
        const accountAKey = getAccountScopedStorageKeyForAccount('@journal_entries', 'account-a');
        let delayed = false;
        adapter = {
            ...adapter,
            getItem: async (key) => {
                if (key === accountAKey && !delayed) {
                    delayed = true;
                    started.resolve();
                    await release.promise;
                }
                return values.get(key) ?? null;
            },
        };
        values.set('@journal_entries', JSON.stringify({ legacy: completedEntry('legacy') }));
        setStorageAdapter(adapter);
        await activateAccount('account-a');

        const blocker = createEntry({ status: 'draft', messages: [], title: 'blocker' });
        await started.promise;
        const migration = migrateLegacyJournalEntriesToActiveAccount();
        const switching = activateAccount('account-b');
        release.resolve();

        await expect(blocker).rejects.toThrow('Account operation was aborted');
        await expect(migration).rejects.toThrow('Account operation was aborted');
        await switching;
        expect(values.get('@journal_entries')).toBeTruthy();
        expect(values.has(getAccountScopedStorageKeyForAccount('@journal_entries', 'account-b'))).toBe(false);
    });
});
