import {
    applyPasswordRecoveryUrl,
    sendPasswordResetEmail,
    signInWithEmail,
    signOut,
    signUpWithEmail,
    updatePassword,
} from '@/services/auth/authService';
import { useCallback } from 'react';

export function useAuthActions() {
    return {
        signIn: useCallback((email: string, password: string) => (
            signInWithEmail(email, password)
        ), []),
        signUp: useCallback((email: string, password: string) => (
            signUpWithEmail(email, password)
        ), []),
        sendPasswordReset: useCallback((email: string) => (
            sendPasswordResetEmail(email)
        ), []),
        signOut: useCallback(() => signOut(), []),
        applyPasswordRecoveryUrl: useCallback((url: string) => (
            applyPasswordRecoveryUrl(url)
        ), []),
        updatePassword: useCallback((password: string) => updatePassword(password), []),
    };
}
