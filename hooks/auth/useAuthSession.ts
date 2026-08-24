import type { AuthSessionLike } from '@/services/auth/authBootstrap';
import {
    getAuthCoordinatorSnapshot,
    subscribeAuthCoordinator,
} from '@/services/auth/authCoordinator';
import { useSyncExternalStore } from 'react';

interface AuthUserState {
    readonly id: string;
    readonly email: string | null;
}

export interface AuthSessionState {
    readonly session: AuthSessionLike | null;
    readonly user: AuthUserState | null;
    readonly isAnonymous: boolean;
    readonly isAuthenticated: boolean;
    readonly isOffline: boolean;
    readonly isLoading: boolean;
}

export function useAuthSession(): AuthSessionState {
    const { authState, isLoading } = useSyncExternalStore(
        subscribeAuthCoordinator,
        getAuthCoordinatorSnapshot,
        getAuthCoordinatorSnapshot,
    );

    const user = authState.account
        ? { id: authState.account.id, email: authState.account.email }
        : null;

    return {
        session: authState.session,
        user,
        isAnonymous: false,
        isAuthenticated: authState.status !== 'signed-out',
        isOffline: authState.status === 'offline',
        isLoading,
    };
}
