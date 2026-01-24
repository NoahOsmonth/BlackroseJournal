import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '@/app/(auth)/login';
import SignupScreen from '@/app/(auth)/signup';
import ForgotPasswordScreen from '@/app/(auth)/forgot-password';
import UpdatePasswordScreen from '@/app/(auth)/update-password';
import { useAuthSession } from '@/hooks/auth/useAuthSession';
import { signInWithEmail, signUpWithEmail, sendPasswordResetEmail } from '@/services/auth/authService';
import { getSupabaseClient } from '@/services/supabase/supabaseClient';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: mockPush,
        replace: mockReplace,
        back: mockBack,
    }),
}));

jest.mock('@/hooks/auth/useAuthSession', () => ({
    useAuthSession: jest.fn(),
}));

jest.mock('@/services/auth/authService', () => ({
    signInWithEmail: jest.fn(),
    signUpWithEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
}));

jest.mock('@/services/supabase/supabaseClient', () => ({
    getSupabaseClient: jest.fn(),
}));

jest.mock('expo-linking', () => ({
    getInitialURL: jest.fn(() => Promise.resolve(null)),
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    createURL: jest.fn(() => 'app://update-password'),
}));

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

describe('Auth screens', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (useAuthSession as jest.Mock).mockReturnValue({
            user: null,
            isLoading: false,
            isAnonymous: true,
        });
        (getSupabaseClient as jest.Mock).mockReturnValue({
            auth: {
                setSession: jest.fn().mockResolvedValue({ error: null }),
                updateUser: jest.fn().mockResolvedValue({ error: null }),
            },
        });
    });

    it('signs in from login screen', async () => {
        (signInWithEmail as jest.Mock).mockResolvedValue({ user: { id: 'user-1' }, session: {} });
        const { getByPlaceholderText, getByText } = render(<LoginScreen />);

        fireEvent.changeText(getByPlaceholderText('you@email.com'), 'test@example.com');
        fireEvent.changeText(getByPlaceholderText('••••••••'), 'password123');
        fireEvent.press(getByText('Sign in'));

        await waitFor(() => {
            expect(signInWithEmail).toHaveBeenCalledWith('test@example.com', 'password123');
        });
    });

    it('signs up from signup screen', async () => {
        (signUpWithEmail as jest.Mock).mockResolvedValue({ user: { id: 'user-2' }, session: null });
        const { getByPlaceholderText, getAllByPlaceholderText, getAllByText } = render(<SignupScreen />);

        fireEvent.changeText(getByPlaceholderText('you@email.com'), 'new@example.com');
        const [passwordField, confirmField] = getAllByPlaceholderText('••••••••');
        fireEvent.changeText(passwordField, 'newpassword');
        fireEvent.changeText(confirmField, 'newpassword');

        const signupButtons = getAllByText('Create account');
        fireEvent.press(signupButtons[signupButtons.length - 1]);

        await waitFor(() => {
            expect(signUpWithEmail).toHaveBeenCalledWith('new@example.com', 'newpassword');
        });
    });

    it('sends password reset email', async () => {
        (sendPasswordResetEmail as jest.Mock).mockResolvedValue(undefined);
        const { getByPlaceholderText, getByText } = render(<ForgotPasswordScreen />);

        fireEvent.changeText(getByPlaceholderText('you@email.com'), 'reset@example.com');
        fireEvent.press(getByText('Send reset email'));

        await waitFor(() => {
            expect(sendPasswordResetEmail).toHaveBeenCalledWith('reset@example.com');
        });
    });

    it('updates password when session is available', async () => {
        (useAuthSession as jest.Mock).mockReturnValue({
            user: { email: 'user@example.com' },
            isLoading: false,
            isAnonymous: false,
        });

        const client = getSupabaseClient() as unknown as { auth: { updateUser: jest.Mock } };
        const { getAllByPlaceholderText, getAllByText, queryByText } = render(<UpdatePasswordScreen />);

        await waitFor(() => {
            expect(queryByText('Checking your recovery link...')).toBeNull();
        });

        const [passwordField, confirmField] = getAllByPlaceholderText('••••••••');
        fireEvent.changeText(passwordField, 'newpassword');
        fireEvent.changeText(confirmField, 'newpassword');

        const updateButtons = getAllByText('Update password');
        fireEvent.press(updateButtons[updateButtons.length - 1]);

        await waitFor(() => {
            expect(client.auth.updateUser).toHaveBeenCalledWith({ password: 'newpassword' });
        });
    });
});
