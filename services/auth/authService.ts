import { getPasswordResetRedirectUrl } from '@/services/auth/authLinking';
import { getSupabaseClient } from '@/services/supabase/supabaseClient';
import type { Session, User } from '@supabase/supabase-js';

const MISSING_CONFIG_MESSAGE =
    'Supabase config missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.';

function getClientOrThrow() {
    const client = getSupabaseClient();
    if (!client) {
        throw new Error(MISSING_CONFIG_MESSAGE);
    }
    return client;
}

export async function signUpWithEmail(
    email: string,
    password: string
): Promise<{ user: User | null; session: Session | null }> {
    const client = getClientOrThrow();
    const { data, error } = await client.auth.signUp({
        email,
        password,
    });

    if (error) {
        throw new Error(error.message);
    }

    return {
        user: data?.user ?? null,
        session: data?.session ?? null,
    };
}

export async function signInWithEmail(
    email: string,
    password: string
): Promise<{ user: User | null; session: Session | null }> {
    const client = getClientOrThrow();
    const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        throw new Error(error.message);
    }

    return {
        user: data?.user ?? null,
        session: data?.session ?? null,
    };
}

export async function sendPasswordResetEmail(
    email: string,
    redirectTo?: string
): Promise<void> {
    const client = getClientOrThrow();
    const resolvedRedirect = redirectTo || getPasswordResetRedirectUrl();
    const options = resolvedRedirect ? { redirectTo: resolvedRedirect } : undefined;
    const { error } = await client.auth.resetPasswordForEmail(email, options);

    if (error) {
        throw new Error(error.message);
    }
}

export async function signOut(): Promise<void> {
    const client = getClientOrThrow();
    const { error } = await client.auth.signOut();

    if (error) {
        throw new Error(error.message);
    }
}

export async function refreshSession(): Promise<void> {
    const client = getClientOrThrow();
    const { error } = await client.auth.refreshSession();

    if (error) {
        throw new Error(error.message);
    }
}
