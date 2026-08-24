/* eslint-disable import/first */

import { act, renderHook } from '@testing-library/react-native';

type TestSnapshot = {
    authState: {
        status: 'signed-out' | 'authenticated' | 'offline';
        account: { id: string; email: string | null; lastAuthenticatedAt: number } | null;
        session: { user: { id: string; email?: string | null } } | null;
    };
    isLoading: boolean;
};

let mockSnapshot: TestSnapshot = {
    authState: { status: 'signed-out', account: null, session: null },
    isLoading: true,
};
let mockListener: (() => void) | null = null;

jest.mock('../../../services/auth/authCoordinator', () => ({
    getAuthCoordinatorSnapshot: () => mockSnapshot,
    subscribeAuthCoordinator: (listener: () => void) => {
        mockListener = listener;
        return () => { mockListener = null; };
    },
}));

import { useAuthSession } from '../../../hooks/auth/useAuthSession';

describe('useAuthSession', () => {
    beforeEach(() => {
        mockSnapshot = {
            authState: { status: 'signed-out', account: null, session: null },
            isLoading: true,
        };
        mockListener = null;
    });

    it('maps the shared coordinator loading snapshot', () => {
        const { result } = renderHook(() => useAuthSession());

        expect(result.current.isLoading).toBe(true);
        expect(result.current.isAuthenticated).toBe(false);
    });

    it('updates all auth fields from an offline coordinator snapshot', () => {
        const { result } = renderHook(() => useAuthSession());
        act(() => {
            mockSnapshot = {
                authState: {
                    status: 'offline',
                    account: {
                        id: 'user-a', email: 'a@example.com', lastAuthenticatedAt: 1,
                    },
                    session: null,
                },
                isLoading: false,
            };
            mockListener?.();
        });

        expect(result.current.user).toEqual({ id: 'user-a', email: 'a@example.com' });
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.isOffline).toBe(true);
    });
});
