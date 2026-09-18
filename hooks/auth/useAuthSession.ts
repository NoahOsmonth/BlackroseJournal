import { localAccountStore } from '@/services/auth/localAccount';
import { useSyncExternalStore } from 'react';

interface AuthUserState {
    readonly id: string;
    readonly email: string | null;
}

export interface AuthSessionState {
    readonly user: AuthUserState | null;
    readonly isAuthenticated: boolean;
    readonly isLoading: boolean;
}

/**
 * Auth session backed by the device-local account (no remote auth). The shape
 * mirrors the previous Supabase-backed hook so call sites stay unchanged.
 */
export function useAuthSession(): AuthSessionState {
    const state = useSyncExternalStore(
        localAccountStore.subscribe,
        localAccountStore.getSnapshot,
        localAccountStore.getSnapshot,
    );

    const user = state.account
        ? { id: state.account.id, email: state.account.email }
        : null;

    return {
        user,
        isAuthenticated: state.status === 'authenticated',
        isLoading: state.status === 'loading',
    };
}
