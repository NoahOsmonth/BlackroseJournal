/* eslint-disable import/first */

const mockAsyncStorageStore = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn((key: string) => Promise.resolve(mockAsyncStorageStore.get(key) ?? null)),
        setItem: jest.fn((key: string, value: string) => {
            mockAsyncStorageStore.set(key, value);
            return Promise.resolve();
        }),
        removeItem: jest.fn((key: string) => {
            mockAsyncStorageStore.delete(key);
            return Promise.resolve();
        }),
    },
}));

jest.mock('../../services/goals/goalsRemote', () => ({
    fetchRemoteGoals: jest.fn(() => Promise.resolve(null)),
    mergeGoals: jest.fn((local: object) => local),
    pushGoals: jest.fn(() => Promise.resolve(false)),
    queueGoalDelete: jest.fn(() => Promise.resolve()),
    queueGoalUpsert: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../services/supabase/syncQueue', () => ({
    enqueueSyncTask: jest.fn(() => Promise.resolve()),
    removeSyncTasksForTable: jest.fn(() => Promise.resolve()),
}));

import { renderHook, act, waitFor, cleanup } from '@testing-library/react-native';
import { useGoalsContext } from '../../hooks/goals/useGoalsContext';
import { createGoal } from '../../services/goals/goalsStorage';

describe('useGoalsContext', () => {
    beforeEach(() => {
        mockAsyncStorageStore.clear();
        cleanup();
    });

    it('starts loading and returns undefined context until goals load', async () => {
        const { result } = renderHook(() => useGoalsContext());

        expect(result.current.isLoading).toBe(true);
        expect(result.current.goalsContext).toBeUndefined();

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.goalsContext).toBeUndefined();
    });

    it('builds a formatted goals context after loading active goals and habits', async () => {
        await act(async () => {
            await createGoal({ title: 'Run a half-marathon', type: 'goal' });
            await createGoal({ title: 'Morning meditation', type: 'habit' });
        });

        const { result } = renderHook(() => useGoalsContext());

        await waitFor(() => expect(result.current.goalsContext).toBeDefined());

        expect(result.current.goalsContext).toContain("## User's Current Goals and Habits");
        expect(result.current.goalsContext).toContain('- Run a half-marathon (Goal)');
        expect(result.current.goalsContext).toContain('- Morning meditation (daily');
    });

    it('exposes refresh that reloads goals', async () => {
        const { result } = renderHook(() => useGoalsContext());

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.goalsContext).toBeUndefined();

        await act(async () => {
            await createGoal({ title: 'New goal', type: 'goal' });
        });

        await act(async () => {
            await result.current.refresh();
        });

        await waitFor(() => expect(result.current.goalsContext).toBeDefined());
        expect(result.current.goalsContext).toContain('- New goal (Goal)');
    });

    it('refreshes automatically when goals storage changes', async () => {
        const { result } = renderHook(() => useGoalsContext());

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.goalsContext).toBeUndefined();

        await act(async () => {
            await createGoal({ title: 'Auto-updated goal', type: 'goal' });
        });

        await waitFor(() => expect(result.current.goalsContext).toContain('- Auto-updated goal (Goal)'));
    });

    it('prioritizes goals linked to the provided intentionId', async () => {
        await act(async () => {
            await createGoal({ title: 'Linked goal', type: 'goal', intentionId: 'int-1' });
            await createGoal({ title: 'Other goal', type: 'goal' });
        });

        const { result } = renderHook(() => useGoalsContext({ intentionId: 'int-1' }));

        await waitFor(() => expect(result.current.goalsContext).toBeDefined());

        const context = result.current.goalsContext!;
        expect(context.indexOf('- Linked goal (Goal)')).toBeLessThan(
            context.indexOf('- Other goal (Goal)')
        );
    });
});
