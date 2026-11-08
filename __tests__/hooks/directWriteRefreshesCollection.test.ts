/**
 * The whole point of the bus: a write made OUTSIDE the hook (backup restore,
 * demo seed, Explore note) must still refresh a mounted collection hook.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { setAccountStorageAdapter } from '../../services/account/accountScopedStorage';
import type { AccountStorageAdapter } from '../../services/account/accountScopedStorage';
import { activateAccount, clearActiveAccount } from '../../services/account/accountRuntime';
import { useJournalEntries } from '../../hooks/journal/useJournalEntries';
import { createEntry, resetStorageAdapter, setStorageAdapter } from '../../services/journal/journalStorage';

jest.mock('../../hooks/account/useActiveAccountId', () => ({
    useActiveAccountId: () => 'perf-account',
}));

function memoryAdapter() {
    // ONE shared backend: journalStorage has its own adapter setter, so both
    // the account-scoped layer and the collection service must point at it.
    const rows = new Map<string, string>();
    const adapter: AccountStorageAdapter = {
        getItem: (k) => Promise.resolve(rows.get(k) ?? null),
        setItem: (k, v) => { rows.set(k, v); return Promise.resolve(); },
        removeItem: (k) => { rows.delete(k); return Promise.resolve(); },
    };
    return { rows, adapter };
}

describe('a direct write keeps a mounted hook fresh', () => {
    beforeEach(async () => {
        jest.useRealTimers();
        await clearActiveAccount();
        const backend = memoryAdapter();
        setAccountStorageAdapter(backend.adapter);
        setStorageAdapter(backend.adapter);
        await activateAccount('perf-account');
    });

    afterEach(async () => {
        resetStorageAdapter();
        await clearActiveAccount();
    });

    it('shows a new entry written straight through the service', async () => {
        const { result } = renderHook(() => useJournalEntries());
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.completed).toHaveLength(0);

        // This is the backup-restore / demo-seed / Explore-note shape: a
        // service call with NO hook refresh and NO focus event.
        await act(async () => {
            await createEntry({
                title: 'Written elsewhere',
                messages: [{ id: 'm1', role: 'user', content: 'A note from Explore', timestamp: Date.now() }],
                status: 'completed',
            });
            // Let the microtask-scheduled refresh settle.
            await Promise.resolve();
            await Promise.resolve();
        });

        await waitFor(() => expect(result.current.completed).toHaveLength(1));
        expect(result.current.completed[0].title).toBe('Written elsewhere');
        // The real value is in storage, not a phantom from a settled cache.
        expect(result.current.entries[0].title).toBe('Written elsewhere');
    });
});
