import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useAuthSession } from '../../hooks/auth/useAuthSession';
import { getSupabaseClient } from '../../services/supabase/supabaseClient';

const mockSubscription = { unsubscribe: jest.fn() };
const mockOnAuthStateChange = jest.fn();
const mockGetSession = jest.fn();

jest.mock('../../services/supabase/supabaseClient', () => ({
    getSupabaseClient: jest.fn(),
}));

describe('useAuthSession', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('loads initial session and listens for changes', async () => {
        let authCallback: ((event: string, session: any) => void) | null = null;

        mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'user-1' } } } });
        mockOnAuthStateChange.mockImplementationOnce((callback: (event: string, session: any) => void) => {
            authCallback = callback;
            return { data: { subscription: mockSubscription } };
        });

        (getSupabaseClient as jest.Mock).mockReturnValue({
            auth: {
                getSession: mockGetSession,
                onAuthStateChange: mockOnAuthStateChange,
            },
        });

        const { result } = renderHook(() => useAuthSession());

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.user?.id).toBe('user-1');
        expect(result.current.isAnonymous).toBe(true);

        act(() => {
            authCallback?.('SIGNED_IN', { user: { id: 'user-2', email: 'user@example.com' } });
        });

        expect(result.current.user?.id).toBe('user-2');
        expect(result.current.isAnonymous).toBe(false);
    });

    it('handles missing supabase client', async () => {
        (getSupabaseClient as jest.Mock).mockReturnValue(null);

        const { result } = renderHook(() => useAuthSession());

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.user).toBeNull();
        expect(result.current.isAnonymous).toBe(false);
    });
});
