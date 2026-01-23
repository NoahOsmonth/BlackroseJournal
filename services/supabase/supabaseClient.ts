import AsyncStorage from '@react-native-async-storage/async-storage';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './supabaseConfig';

const MISSING_CONFIG_MESSAGE =
    'Supabase config missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.';

let supabaseClient: SupabaseClient | null = null;
let hasWarnedMissingConfig = false;
let sessionPromise: Promise<SupabaseClient | null> | null = null;

export function setSupabaseClient(client: SupabaseClient | null): void {
    supabaseClient = client;
}

export function resetSupabaseClient(): void {
    supabaseClient = null;
    hasWarnedMissingConfig = false;
    sessionPromise = null;
}

export function getSupabaseClient(): SupabaseClient | null {
    if (supabaseClient) {
        return supabaseClient;
    }

    const config = getSupabaseConfig();
    if (!config) {
        if (!hasWarnedMissingConfig) {
            console.warn(MISSING_CONFIG_MESSAGE);
            hasWarnedMissingConfig = true;
        }
        return null;
    }

    supabaseClient = createClient(config.url, config.anonKey, {
        auth: {
            storage: AsyncStorage,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
        },
    });

    return supabaseClient;
}

async function ensureAnonymousSession(client: SupabaseClient): Promise<boolean> {
    const { data, error } = await client.auth.getSession();

    if (error) {
        console.warn('Supabase session error:', error.message);
    }

    if (data?.session) {
        return true;
    }

    const { error: signInError } = await client.auth.signInAnonymously();
    if (signInError) {
        console.warn('Supabase anonymous sign-in failed:', signInError.message);
        return false;
    }

    return true;
}

export async function ensureSupabaseSession(): Promise<SupabaseClient | null> {
    if (sessionPromise) {
        return sessionPromise;
    }

    sessionPromise = (async () => {
        const client = getSupabaseClient();
        if (!client) {
            return null;
        }

        const ready = await ensureAnonymousSession(client);
        return ready ? client : null;
    })();

    const result = await sessionPromise;
    sessionPromise = null;

    return result;
}

export async function getSupabaseUserId(): Promise<string | null> {
    const client = await ensureSupabaseSession();
    if (!client) {
        return null;
    }

    const { data } = await client.auth.getSession();
    return data?.session?.user?.id ?? null;
}
