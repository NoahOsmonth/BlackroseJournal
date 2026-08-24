/* eslint-disable import/first */

const mockEnsureSupabaseSession = jest.fn();

jest.mock('../../../services/supabase/supabaseClient', () => ({
    ensureSupabaseSession: (...args: unknown[]) => mockEnsureSupabaseSession(...args),
}));

import { activateAccount, clearActiveAccount, getActiveAccountId } from '../../../services/account/accountRuntime';
import { getAccountScopedStorageKey } from '../../../services/account/accountScopedStorage';
import {
    enqueueSyncTask,
    flushSyncQueue,
    resetSyncQueueStorageAdapter,
    setSyncQueueStorageAdapter,
} from '../../../services/supabase/syncQueue';

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
    return { promise, resolve };
}

describe('account-owned sync queue', () => {
    const store = new Map<string, string>();
    const originalProvider = process.env.EXPO_PUBLIC_DATA_PROVIDER;

    beforeEach(async () => {
        process.env.EXPO_PUBLIC_DATA_PROVIDER = 'remote';
        store.clear();
        mockEnsureSupabaseSession.mockReset();
        setSyncQueueStorageAdapter({
            getItem: async (key) => store.get(key) ?? null,
            setItem: async (key, value) => { store.set(key, value); },
        });
        await activateAccount('user-a');
    });

    afterEach(async () => {
        await clearActiveAccount();
        resetSyncQueueStorageAdapter();
        process.env.EXPO_PUBLIC_DATA_PROVIDER = originalProvider;
    });

    it('finishes account A flush before account B becomes active', async () => {
        const clientReady = deferred<object>();
        const appliedUnder: (string | null)[] = [];
        const client = {
            auth: {
                getSession: async () => ({
                    data: { session: { user: { id: 'user-a' } } }, error: null,
                }),
            },
            from: () => ({
                upsert: async () => {
                    appliedUnder.push(getActiveAccountId());
                    return { error: null };
                },
            }),
        };
        mockEnsureSupabaseSession.mockReturnValue(clientReady.promise);

        await enqueueSyncTask({
            table: 'journal_entries',
            operation: 'upsert',
            payload: { id: 'entry-a' },
        });
        const switching = activateAccount('user-b');
        await Promise.resolve();

        expect(getActiveAccountId()).toBe('user-a');
        clientReady.resolve(client);
        await switching;

        expect(appliedUnder).toEqual(['user-a']);
        expect(getActiveAccountId()).toBe('user-b');
    });

    it('quarantines a task whose owner does not match the active account', async () => {
        const from = jest.fn(() => ({
            upsert: async () => ({ error: null }),
        }));
        mockEnsureSupabaseSession.mockResolvedValue({ from });
        const queueKey = getAccountScopedStorageKey('@supabase_sync_queue');
        store.set(queueKey, JSON.stringify([{
            id: 'foreign-task',
            accountId: 'user-b',
            table: 'journal_entries',
            operation: 'upsert',
            payload: { id: 'entry-b' },
            createdAt: 1,
        }]));

        await flushSyncQueue();

        expect(from).not.toHaveBeenCalled();
        expect(JSON.parse(store.get(queueKey) ?? '[]')).toEqual([]);
        const quarantineKey = getAccountScopedStorageKey('@supabase_sync_queue_quarantine');
        expect(JSON.parse(store.get(quarantineKey) ?? '[]')).toEqual([
            expect.objectContaining({ id: 'foreign-task', accountId: 'user-b' }),
        ]);
    });

    it('quarantines account A tasks when the Supabase session already belongs to B', async () => {
        const from = jest.fn(() => ({
            upsert: async () => ({ error: null }),
        }));
        mockEnsureSupabaseSession.mockResolvedValue({
            auth: {
                getSession: async () => ({
                    data: { session: { user: { id: 'user-b' } } }, error: null,
                }),
            },
            from,
        });
        const task = await enqueueSyncTask({
            table: 'journal_entries',
            operation: 'upsert',
            payload: { id: 'entry-a' },
        });

        await flushSyncQueue();

        expect(from).not.toHaveBeenCalled();
        const quarantineKey = getAccountScopedStorageKey('@supabase_sync_queue_quarantine');
        expect(JSON.parse(store.get(quarantineKey) ?? '[]')).toEqual([
            expect.objectContaining({ id: task.id, accountId: 'user-a' }),
        ]);
    });

    it('serializes concurrent enqueue mutations without dropping either task', async () => {
        mockEnsureSupabaseSession.mockResolvedValue(null);

        await Promise.all([
            enqueueSyncTask({ table: 'journal_entries', operation: 'upsert', payload: { id: 'a' } }),
            enqueueSyncTask({ table: 'goals', operation: 'upsert', payload: { id: 'b' } }),
        ]);
        await flushSyncQueue();

        const queueKey = getAccountScopedStorageKey('@supabase_sync_queue');
        const queue = JSON.parse(store.get(queueKey) ?? '[]') as { accountId: string; table: string }[];
        expect(queue).toHaveLength(2);
        expect(queue.map((task) => task.table).sort()).toEqual(['goals', 'journal_entries']);
        expect(queue.every((task) => task.accountId === 'user-a')).toBe(true);
    });
});
