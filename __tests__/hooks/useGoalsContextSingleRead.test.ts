/**
 * One goals change, one read (Kaneo #101).
 *
 * useGoals refreshes through the collection change bus. useGoalsContext used to
 * add its own subscribeGoalsChanges on top, so every goals write cost two
 * listGoals() reads. The bench could not see this (it counts a cold mount), so
 * it is pinned here as a read count.
 */
import { renderHook, waitFor } from '@testing-library/react-native';

import type { AccountStorageAdapter } from '../../services/account/accountScopedStorage';
import { setAccountStorageAdapter } from '../../services/account/accountScopedStorage';
import { activateAccount, clearActiveAccount } from '../../services/account/accountRuntime';
import { useGoalsContext } from '../../hooks/goals/useGoalsContext';
import { createGoal } from '../../services/goals/goalsStorage';

function countingAdapter(): { adapter: AccountStorageAdapter; reads: (needle: string) => number } {
    const rows = new Map<string, string>();
    const counts = new Map<string, number>();
    return {
        adapter: {
            getItem: (k) => {
                counts.set(k, (counts.get(k) ?? 0) + 1);
                return Promise.resolve(rows.get(k) ?? null);
            },
            setItem: (k, v) => { rows.set(k, v); return Promise.resolve(); },
            removeItem: (k) => { rows.delete(k); return Promise.resolve(); },
        },
        reads: (needle) => {
            let total = 0;
            counts.forEach((n, k) => { if (k.includes(needle)) total += n; });
            return total;
        },
    };
}

describe('useGoalsContext', () => {
    beforeEach(async () => {
        await clearActiveAccount();
        jest.useRealTimers();
    });
    afterEach(async () => { await clearActiveAccount(); });

    it('reads goals once per external change, not twice', async () => {
        const { adapter, reads } = countingAdapter();
        setAccountStorageAdapter(adapter);
        await activateAccount('single-read-account');

        const { result } = renderHook(() => useGoalsContext());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        const before = reads(':goals');
        await createGoal({ title: 'Walk after lunch' } as never);
        // Wait for the change bus to land the refresh, then count what it cost.
        await waitFor(() => expect(reads(':goals')).toBeGreaterThan(before));

        const after = reads(':goals');
        const extraReads = after - before;
        // Two is the floor, not a regression: createGoal reads the map to merge
        // into it, then the change bus triggers one refresh read. A third read
        // means a duplicate subscriber is back in the tree.
        expect(extraReads).toBeLessThanOrEqual(2);
    });
});
