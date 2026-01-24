import { getSupabaseClient } from '@/services/supabase/supabaseClient';
import type { Session, User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

interface AuthSessionState {
    session: Session | null;
    user: User | null;
    isAnonymous: boolean;
    isLoading: boolean;
}

export function useAuthSession(): AuthSessionState {
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const client = getSupabaseClient();
        if (!client) {
            setIsLoading(false);
            return;
        }

        let isMounted = true;

        client.auth.getSession()
            .then(({ data }) => {
                if (!isMounted) return;
                setSession(data?.session ?? null);
            })
            .finally(() => {
                if (isMounted) {
                    setIsLoading(false);
                }
            });

        const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
            if (isMounted) {
                setSession(nextSession);
            }
        });

        return () => {
            isMounted = false;
            data.subscription.unsubscribe();
        };
    }, []);

    return {
        session,
        user: session?.user ?? null,
        isAnonymous: Boolean(session?.user && !session.user.email),
        isLoading,
    };
}
