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
    migrateLegacySyncQueueToActiveAccount,
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
            removeItem: async (key) => { store.delete(key); },
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

    it('stops before the next mutation when the live session switches accounts mid-flush', async () => {
        mockEnsureSupabaseSession.mockResolvedValue(null);
        await enqueueSyncTask({
            table: 'journal_entries', operation: 'upsert', payload: { id: 'first' },
        });
        await enqueueSyncTask({
            table: 'journal_entries', operation: 'upsert', payload: { id: 'second' },
            dedupeKey: 'journal_entries:second',
        });
        await flushSyncQueue();

        let sessionChecks = 0;
        const applied: string[] = [];
        mockEnsureSupabaseSession.mockResolvedValue({
            auth: {
                getSession: async () => {
                    sessionChecks += 1;
                    return {
                        data: {
                            session: { user: { id: sessionChecks < 3 ? 'user-a' : 'user-b' } },
                        },
                        error: null,
                    };
                },
            },
            from: () => ({
                upsert: async (payload: { id: string }) => {
                    applied.push(payload.id);
                    return { error: null };
                },
            }),
        });

        await flushSyncQueue();

        expect(applied).toEqual(['first']);
        const queueKey = getAccountScopedStorageKey('@supabase_sync_queue');
        expect(JSON.parse(store.get(queueKey) ?? '[]')).toEqual([
            expect.objectContaining({ payload: { id: 'second' }, accountId: 'user-a' }),
        ]);
    });

    it('claims and tags the legacy queue only after an account owns it', async () => {
        store.set('@supabase_sync_queue', JSON.stringify([{
            id: 'legacy-task',
            table: 'journal_entries',
            operation: 'upsert',
            payload: { id: 'legacy-entry' },
            createdAt: 1,
        }]));

        await migrateLegacySyncQueueToActiveAccount();

        expect(store.has('@supabase_sync_queue')).toBe(false);
        const queueKey = getAccountScopedStorageKey('@supabase_sync_queue');
        expect(JSON.parse(store.get(queueKey) ?? '[]')).toEqual([
            expect.objectContaining({ id: 'legacy-task', accountId: 'user-a' }),
        ]);
    });

    it('leaves a malformed legacy queue untouched instead of claiming executable garbage', async () => {
        const malformed = JSON.stringify([{ id: 'missing-operation-and-table' }]);
        store.set('@supabase_sync_queue', malformed);

        await expect(migrateLegacySyncQueueToActiveAccount()).rejects.toThrow(
            'Legacy sync queue is invalid and was not claimed.'
        );

        expect(store.get('@supabase_sync_queue')).toBe(malformed);
        expect(store.has(getAccountScopedStorageKey('@supabase_sync_queue'))).toBe(false);
    });
});
