/**
 * Real behavior: a label added OUTSIDE the hook (the editor uses the same
 * service, but so does a restored backup) must refresh a mounted hook.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { setAccountStorageAdapter } from '../../services/account/accountScopedStorage';
import type { AccountStorageAdapter } from '../../services/account/accountScopedStorage';
import { activateAccount, clearActiveAccount } from '../../services/account/accountRuntime';
import { useEntryTags } from '../../hooks/journal/useEntryTags';
import { addEntryTag, setEntryTagMap } from '../../services/journal/entryTags';

jest.mock('../../hooks/account/useActiveAccountId', () => ({
    useActiveAccountId: () => 'labels-hook-account',
}));

function memoryAdapter() {
    const rows = new Map<string, string>();
    const adapter: AccountStorageAdapter = {
        getItem: (k) => Promise.resolve(rows.get(k) ?? null),
        setItem: (k, v) => { rows.set(k, v); return Promise.resolve(); },
        removeItem: (k) => { rows.delete(k); return Promise.resolve(); },
    };
    return adapter;
}

describe('a label written anywhere refreshes a mounted hook', () => {
    beforeEach(async () => {
        await clearActiveAccount();
        setAccountStorageAdapter(memoryAdapter());
        await activateAccount('labels-hook-account');
    });
    afterEach(async () => { await clearActiveAccount(); });

    it('shows a label added straight through the service', async () => {
        const { result, unmount } = renderHook(() => useEntryTags());
        await waitFor(() => expect(result.current.tagsFor('e1')).toEqual([]));
        await act(async () => { await addEntryTag('e1', 'trip'); });
        await waitFor(() => expect(result.current.tagsFor('e1')).toEqual(['trip']));
        await act(async () => { await setEntryTagMap({ e2: ['work'] }); });
        await waitFor(() => expect(result.current.tagsFor('e1')).toEqual([]));
        expect(result.current.tagsFor('e2')).toEqual(['work']);
        unmount();
    });
});
