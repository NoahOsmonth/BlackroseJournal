import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform, type NativeEventSubscription } from 'react-native';
import { isRemoteDataSyncEnabled } from '@/services/data/dataProvider';
import { getSupabaseConfig } from './supabaseConfig';
import { resilientAuthLock } from './authLock';
import type { SupabaseClient } from '@supabase/supabase-js';

const MISSING_CONFIG_MESSAGE =
    'Supabase config missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.';

let supabaseClient: SupabaseClient | null = null;
let hasWarnedMissingConfig = false;
let sessionPromise: Promise<SupabaseClient | null> | null = null;
let authRefreshSubscription: NativeEventSubscription | null = null;

export function setSupabaseClient(client: SupabaseClient | null): void {
    supabaseClient = client;
}

export function resetSupabaseClient(): void {
    authRefreshSubscription?.remove();
    authRefreshSubscription = null;
    supabaseClient?.auth.stopAutoRefresh?.();
    supabaseClient = null;
    hasWarnedMissingConfig = false;
    sessionPromise = null;
}

function registerAuthRefreshLifecycle(client: SupabaseClient): void {
    if (Platform.OS === 'web' || authRefreshSubscription) return;
    if (AppState.currentState === 'active') {
        client.auth.startAutoRefresh();
    }
    authRefreshSubscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
            client.auth.startAutoRefresh();
        } else {
            client.auth.stopAutoRefresh();
        }
    });
}

/**
 * supabase-js derives this key from the project host when no `storageKey` is
 * configured. Naming it explicitly (same value) lets sign-out drop the stored
 * session locally while the server is unreachable.
 */
function authStorageKeyFor(url: string): string {
    const projectRef = new URL(url).hostname.split('.')[0];
    return `sb-${projectRef}-auth-token`;
}

/**
 * Removes the persisted Supabase session. Without this, an offline sign-out
 * survives the current screen only: the next boot would find the untouched
 * session, refresh it once connectivity returns, and show the journal again.
 */
export async function clearStoredAuthSession(): Promise<void> {
    const config = getSupabaseConfig();
    if (!config) return;
    try {
        await AsyncStorage.removeItem(authStorageKeyFor(config.url));
    } catch (error) {
        console.warn('Failed to clear the stored Supabase session', error);
    }
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
            storageKey: authStorageKeyFor(config.url),
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
            // Navigator locks abort queued acquires after 10s; a single
            // unreachable auth server holds the lock for ~30s of refresh
            // retries, which used to surface as uncaught AbortErrors.
            lock: resilientAuthLock,
        },
    });
    registerAuthRefreshLifecycle(supabaseClient);

    return supabaseClient;
}

/**
 * The slice of a Supabase session these services consume. Declared structurally
 * so tests can inject a plain object and so callers only depend on what they use.
 */
export interface SupabaseSessionLike {
    readonly access_token: string;
    readonly user: { readonly id: string; readonly is_anonymous?: boolean };
}

/**
 * The slice of a Supabase auth client these services consume. Declared
 * structurally so tests can inject a plain object.
 */
export interface SupabaseSessionReader {
    auth: {
        getSession(): Promise<{
            data: { session: SupabaseSessionLike | null };
            error: { message: string } | null;
        }>;
    };
}

/**
 * `auth.getSession()` rejects (rather than returning `{ error }`) when the
 * underlying lock acquire aborts or the transport dies. Every caller that only
 * wants "is there a session?" goes through here so those faults stay soft.
 */
export async function getSessionSafely(
    client: SupabaseSessionReader
): Promise<{ session: SupabaseSessionLike | null; error: Error | null }> {
    try {
        const { data, error } = await client.auth.getSession();
        if (error) {
            return { session: null, error: new Error(error.message) };
        }
        return { session: data.session ?? null, error: null };
    } catch (thrown) {
        return {
            session: null,
            error: thrown instanceof Error ? thrown : new Error(String(thrown)),
        };
    }
}

async function ensureAnonymousSession(client: SupabaseClient): Promise<boolean> {
    const { session, error } = await getSessionSafely(client);

    if (error) {
        console.warn('Supabase session error:', error.message);
    }

    if (session) {
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
    if (!isRemoteDataSyncEnabled()) {
        return null;
    }

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

    const { session } = await getSessionSafely(client);
    return session?.user?.id ?? null;
}
