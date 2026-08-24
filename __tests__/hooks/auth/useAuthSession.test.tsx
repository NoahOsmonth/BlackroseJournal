/* eslint-disable import/first */

import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockUnsubscribe = jest.fn();
let mockAuthListener: ((event: string, session: unknown) => void) | null = null;
const mockClient = {
    auth: {
        onAuthStateChange: jest.fn((listener: (event: string, session: unknown) => void) => {
            mockAuthListener = listener;
            return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
        }),
    },
};
const mockBootstrapAuth = jest.fn();
const mockHandleAuthSessionChange = jest.fn();

jest.mock('../../../services/supabase/supabaseClient', () => ({
    getSupabaseClient: jest.fn(() => mockClient),
}));

jest.mock('../../../services/auth/authBootstrap', () => ({
    bootstrapAuth: (...args: unknown[]) => mockBootstrapAuth(...args),
    handleAuthSessionChange: (...args: unknown[]) => mockHandleAuthSessionChange(...args),
}));

import { useAuthSession } from '../../../hooks/auth/useAuthSession';

describe('useAuthSession', () => {
    beforeEach(() => {
        mockAuthListener = null;
        mockUnsubscribe.mockClear();
        mockBootstrapAuth.mockReset();
        mockHandleAuthSessionChange.mockReset();
    });

    it('holds loading until bootstrap opens the account namespace', async () => {
        mockBootstrapAuth.mockResolvedValue({
            status: 'offline',
            account: { id: 'user-a', email: 'a@example.com', lastAuthenticatedAt: 1 },
            session: null,
        });

        const { result } = renderHook(() => useAuthSession());

        expect(result.current.isLoading).toBe(true);
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.user).toEqual({ id: 'user-a', email: 'a@example.com' });
        expect(result.current.isOffline).toBe(true);
    });

    it('applies auth events through account-switch teardown and unsubscribes', async () => {
        mockBootstrapAuth.mockResolvedValue({
            status: 'authenticated',
            account: { id: 'user-a', email: 'a@example.com', lastAuthenticatedAt: 1 },
            session: { user: { id: 'user-a', email: 'a@example.com' } },
        });
        mockHandleAuthSessionChange.mockResolvedValue({
            status: 'authenticated',
            account: { id: 'user-b', email: 'b@example.com', lastAuthenticatedAt: 2 },
            session: { user: { id: 'user-b', email: 'b@example.com' } },
        });

        const { result, unmount } = renderHook(() => useAuthSession());
        await waitFor(() => expect(result.current.user?.id).toBe('user-a'));

        await act(async () => {
            mockAuthListener?.('SIGNED_IN', { user: { id: 'user-b' } });
        });

        await waitFor(() => expect(result.current.user?.id).toBe('user-b'));
        unmount();
        expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });
});
