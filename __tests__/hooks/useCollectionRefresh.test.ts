import { renderHook } from '@testing-library/react-native';

import { useCollectionRefresh } from '../../hooks/collections/useCollectionRefresh';
import { subscribeCollectionChanges } from '../../services/account/accountScopedStorage';

jest.mock('../../services/account/accountScopedStorage', () => ({
    subscribeCollectionChanges: jest.fn(() => jest.fn()),
}));

const mockSubscribe = subscribeCollectionChanges as jest.MockedFunction<typeof subscribeCollectionChanges>;

describe('useCollectionRefresh', () => {
    beforeEach(() => { jest.clearAllMocks(); });

    it('subscribes once and unsubscribes on unmount', () => {
        const off = jest.fn();
        mockSubscribe.mockReturnValue(off);
        const keys = ['@journal_entries'] as const;
        const refresh = jest.fn();
        const { unmount } = renderHook(() => useCollectionRefresh(keys, refresh));
        expect(mockSubscribe).toHaveBeenCalledTimes(1);
        unmount();
        expect(off).toHaveBeenCalledTimes(1);
    });

    it('ignores unrelated keys', async () => {
        let listener: (k: string) => void = () => {};
        mockSubscribe.mockImplementation((cb) => { listener = cb; return jest.fn(); });
        const refresh = jest.fn();
        renderHook(() => useCollectionRefresh(['@goals'], refresh));
        listener('@journal_entries');
        await Promise.resolve();
        expect(refresh).not.toHaveBeenCalled();
    });

    it('collapses a burst of shard writes into ONE refresh', async () => {
        let listener: (k: string) => void = () => {};
        mockSubscribe.mockImplementation((cb) => { listener = cb; return jest.fn(); });
        const refresh = jest.fn();
        const keys = ['@journal_entries', '@journal_entries_shard:0', '@journal_entries_shard:1'];
        renderHook(() => useCollectionRefresh(keys, refresh));
        keys.forEach((k) => listener(k));
        await Promise.resolve();
        expect(refresh).toHaveBeenCalledTimes(1);
        // A later, separate write still refreshes.
        listener('@journal_entries');
        await Promise.resolve();
        expect(refresh).toHaveBeenCalledTimes(2);
    });
});
