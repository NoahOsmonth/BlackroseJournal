import {
    refreshSession,
    sendPasswordResetEmail,
    signInWithEmail,
    signOut,
    signUpWithEmail,
} from '../../services/auth/authService';
import { getSupabaseClient } from '../../services/supabase/supabaseClient';

const mockAuth = {
    signUp: jest.fn(),
    signInWithPassword: jest.fn(),
    resetPasswordForEmail: jest.fn(),
    signOut: jest.fn(),
    refreshSession: jest.fn(),
};

const mockClient = {
    auth: mockAuth,
};

jest.mock('../../services/supabase/supabaseClient', () => ({
    getSupabaseClient: jest.fn(),
}));

describe('authService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getSupabaseClient as jest.Mock).mockReturnValue(mockClient);
    });

    it('signs up with email and password', async () => {
        mockAuth.signUp.mockResolvedValueOnce({
            data: { user: { id: 'user-1' }, session: { access_token: 'token' } },
            error: null,
        });

        const result = await signUpWithEmail('test@example.com', 'password123');

        expect(mockAuth.signUp).toHaveBeenCalledWith({
            email: 'test@example.com',
            password: 'password123',
        });
        expect(result.user?.id).toBe('user-1');
        expect(result.session?.access_token).toBe('token');
    });

    it('signs in with email and password', async () => {
        mockAuth.signInWithPassword.mockResolvedValueOnce({
            data: { user: { id: 'user-2' }, session: { access_token: 'token-2' } },
            error: null,
        });

        const result = await signInWithEmail('me@example.com', 'secret');

        expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
            email: 'me@example.com',
            password: 'secret',
        });
        expect(result.user?.id).toBe('user-2');
    });

    it('sends password reset email', async () => {
        mockAuth.resetPasswordForEmail.mockResolvedValueOnce({ error: null });

        await sendPasswordResetEmail('reset@example.com', 'myapp://reset');

        expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith('reset@example.com', {
            redirectTo: 'myapp://reset',
        });
    });

    it('signs out', async () => {
        mockAuth.signOut.mockResolvedValueOnce({ error: null });

        await signOut();

        expect(mockAuth.signOut).toHaveBeenCalled();
    });

    it('refreshes session', async () => {
        mockAuth.refreshSession.mockResolvedValueOnce({ data: {}, error: null });

        await refreshSession();

        expect(mockAuth.refreshSession).toHaveBeenCalled();
    });
});
