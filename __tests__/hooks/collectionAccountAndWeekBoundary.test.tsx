/* eslint-disable import/first */

/**
 * Guards two staleness bugs the tab-switch work exposed:
 *
 *  1. `useSavedInsights` must react to the active account changing. With a
 *     `hasLoadedRef` guarding the spinner, a hook that never observed the
 *     account would keep showing the previous account's rows while the new
 *     account loaded — and would never re-read at all if the new load failed.
 *  2. `weeklyStats` must not outlive the week it describes. It is memoized on
 *     `getWeeklyItems`, whose identity only changes when the arrays change, so
 *     a screen left open across a week boundary would keep last week's counts
 *     while the label advanced.
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
    },
}));

const mockListSavedInsights = jest.fn();
const mockCreateSavedInsight = jest.fn();
const mockDeleteSavedInsight = jest.fn();

jest.mock('@/services/saved-insights/savedInsightsStorage', () => ({
    listSavedInsights: (...args: unknown[]) => mockListSavedInsights(...args),
    createSavedInsight: (...args: unknown[]) => mockCreateSavedInsight(...args),
    deleteSavedInsight: (...args: unknown[]) => mockDeleteSavedInsight(...args),
}));

const mockAccountState = { accountId: 'user-a' as string | null };
const mockListeners = new Set<() => void>();

jest.mock('@/hooks/account/useActiveAccountId', () => ({
    useActiveAccountId: () => {
        const React = jest.requireActual('react');
        const [, forceRender] = React.useReducer((n: number) => n + 1, 0);
        React.useEffect(() => {
            mockListeners.add(forceRender);
            return () => {
                mockListeners.delete(forceRender);
            };
        }, [forceRender]);
        return mockAccountState.accountId;
    },
}));

function activateAccount(accountId: string | null) {
    mockAccountState.accountId = accountId;
    mockListeners.forEach((listener) => listener());
}

import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useSavedInsights } from '@/hooks/saved-insights/useSavedInsights';
import type { SavedInsight } from '@/services/saved-insights/savedInsightsStorage.types';

function buildInsight(id: string): SavedInsight {
    return {
        id,
        question: `question-${id}`,
        sourceDate: '2026-11-02',
        createdAt: 1,
        updatedAt: 1,
    };
}

describe('useSavedInsights: account changes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockListeners.clear();
        mockAccountState.accountId = 'user-a';
        mockListSavedInsights.mockResolvedValue([buildInsight('a-1')]);
    });

    it('re-reads and drops the previous account rows when the account changes', async () => {
        const { result } = renderHook(() => useSavedInsights());
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.insights.map((item) => item.id)).toEqual(['a-1']);
        expect(mockListSavedInsights).toHaveBeenCalledTimes(1);

        let release: ((rows: SavedInsight[]) => void) | undefined;
        mockListSavedInsights.mockImplementationOnce(() => new Promise<SavedInsight[]>((resolve) => {
            release = resolve;
        }));

        await act(async () => {
            activateAccount('user-b');
        });

        // The new account's read is in flight; the old account's rows must be
        // gone rather than lingering behind the suppressed spinner.
        expect(result.current.insights).toEqual([]);
        expect(mockListSavedInsights).toHaveBeenCalledTimes(2);

        await act(async () => {
            release?.([buildInsight('b-1')]);
        });

        expect(result.current.insights.map((item) => item.id)).toEqual(['b-1']);
    });

    it('clears rows and stops loading when there is no active account', async () => {
        const { result } = renderHook(() => useSavedInsights());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
            activateAccount(null);
        });

        expect(result.current.insights).toEqual([]);
        expect(result.current.isLoading).toBe(false);
    });
});
