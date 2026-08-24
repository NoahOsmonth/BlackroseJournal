import {
    bootstrapAuth,
    handleAuthSessionChange,
    type AuthBootstrapClient,
    type AuthBootstrapState,
    type AuthSessionLike,
} from '@/services/auth/authBootstrap';
import { getSupabaseClient } from '@/services/supabase/supabaseClient';
import { useEffect, useState } from 'react';

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

const SIGNED_OUT_STATE: AuthBootstrapState = {
    status: 'signed-out',
    account: null,
    session: null,
};

export function useAuthSession(): AuthSessionState {
    const [authState, setAuthState] = useState<AuthBootstrapState>(SIGNED_OUT_STATE);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const client = getSupabaseClient();
        let isMounted = true;
        let sequence = 0;

        const apply = async (promise: Promise<AuthBootstrapState>) => {
            const requestSequence = ++sequence;
            try {
                const nextState = await promise;
                if (isMounted && requestSequence === sequence) {
                    setAuthState(nextState);
                }
            } finally {
                if (isMounted && requestSequence === sequence) {
                    setIsLoading(false);
                }
            }
        };

        void apply(bootstrapAuth(client as AuthBootstrapClient | null));

        if (!client) {
            return () => {
                isMounted = false;
            };
        }

        const { data } = client.auth.onAuthStateChange((_event, session) => {
            void apply(handleAuthSessionChange(session));
        });

        return () => {
            isMounted = false;
            sequence += 1;
            data.subscription.unsubscribe();
        };
    }, []);

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
