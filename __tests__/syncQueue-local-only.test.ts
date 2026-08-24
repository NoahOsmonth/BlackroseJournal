/* eslint-disable import/first */

const mockGetItem = jest.fn().mockResolvedValue(null);
const mockSetItem = jest.fn().mockResolvedValue(undefined);

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: mockGetItem,
        setItem: mockSetItem,
    },
}));

const mockEnsureSupabaseSession = jest.fn();

jest.mock('../services/supabase/supabaseClient', () => ({
    ensureSupabaseSession: mockEnsureSupabaseSession,
}));

import {
    enqueueSyncTask,
    flushSyncQueue,
    removeSyncTasksForTable,
    resetSyncQueueStorageAdapter,
    setSyncQueueStorageAdapter,
} from '../services/supabase/syncQueue';
import { activateAccount, clearActiveAccount } from '../services/account/accountRuntime';
import { getAccountScopedStorageKey } from '../services/account/accountScopedStorage';

describe('syncQueue local-only default', () => {
    const originalDataProvider = process.env.EXPO_PUBLIC_DATA_PROVIDER;
    const originalRemoteFlag = process.env.EXPO_PUBLIC_ENABLE_REMOTE_DATA_SYNC;

    afterEach(async () => {
        await clearActiveAccount();
        process.env.EXPO_PUBLIC_DATA_PROVIDER = originalDataProvider;
        process.env.EXPO_PUBLIC_ENABLE_REMOTE_DATA_SYNC = originalRemoteFlag;
        mockGetItem.mockClear();
        mockSetItem.mockClear();
        mockEnsureSupabaseSession.mockClear();
    });

    it('does not persist or flush remote tasks in local-only mode', async () => {
        delete process.env.EXPO_PUBLIC_DATA_PROVIDER;
        delete process.env.EXPO_PUBLIC_ENABLE_REMOTE_DATA_SYNC;

        const task = await enqueueSyncTask({
            table: 'journal_entries',
            operation: 'upsert',
            payload: { id: 'entry-1' },
        });
        await flushSyncQueue();

        expect(task.table).toBe('journal_entries');
        expect(mockSetItem).not.toHaveBeenCalled();
        expect(mockEnsureSupabaseSession).not.toHaveBeenCalled();
    });

    it('removeSyncTasksForTable drops only tasks for the given table', async () => {
        process.env.EXPO_PUBLIC_DATA_PROVIDER = 'remote';
        await activateAccount('queue-user');
        const store = new Map<string, string>();
        setSyncQueueStorageAdapter({
            getItem: (key) => Promise.resolve(store.get(key) ?? null),
            setItem: (key, value) => {
                store.set(key, value);
                return Promise.resolve();
            },
        });
        const queueKey = getAccountScopedStorageKey('@supabase_sync_queue');
        store.set(queueKey, JSON.stringify([
            { id: 't1', accountId: 'queue-user', table: 'journal_entries', operation: 'upsert', payload: { id: 'e1' }, createdAt: 1 },
            { id: 't2', accountId: 'queue-user', table: 'goals', operation: 'upsert', payload: { id: 'g1' }, createdAt: 2 },
            {
                id: 't3', accountId: 'queue-user', table: 'journal_entries', operation: 'delete',
                primaryKey: 'id', primaryValue: 'e2', createdAt: 3,
            },
        ]));

        await removeSyncTasksForTable('journal_entries');

        const savedQueue = JSON.parse(store.get(queueKey) ?? '[]');
        expect(savedQueue).toHaveLength(1);
        expect(savedQueue[0].table).toBe('goals');

        resetSyncQueueStorageAdapter();
    });
});
