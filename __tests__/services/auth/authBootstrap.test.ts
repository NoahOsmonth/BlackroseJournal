import {
    AUTH_BOOTSTRAP_TIMEOUT_MS,
    bootstrapAuth,
    resolveAuthSessionEvent,
    type AuthBootstrapClient,
} from '@/services/auth/authBootstrap';
import {
    clearActiveAccount,
    getActiveAccountId,
} from '@/services/account/accountRuntime';
import {
    loadRememberedAccount,
    rememberAuthenticatedAccount,
    resetAccountRegistryStorageAdapter,
    setAccountRegistryStorageAdapter,
} from '@/services/account/accountRegistry';

function createMemoryStorage() {
    const values = new Map<string, string>();
    return {
        getItem: async (key: string) => values.get(key) ?? null,
        setItem: async (key: string, value: string) => {
            values.set(key, value);
        },
        removeItem: async (key: string) => {
            values.delete(key);
        },
    };
}

type AuthSessionResponse = Awaited<ReturnType<AuthBootstrapClient['auth']['getSession']>>;

function createClient(result: AuthSessionResponse): AuthBootstrapClient {
    return {
        auth: {
            getSession: jest.fn(async () => result),
        },
    };
}

describe('auth bootstrap', () => {
    beforeEach(async () => {
        setAccountRegistryStorageAdapter(createMemoryStorage());
        await clearActiveAccount();
    });

    afterEach(async () => {
        await clearActiveAccount();
        resetAccountRegistryStorageAdapter();
    });

    it('opens and remembers the authenticated session account', async () => {
        const client = createClient({
            data: {
                session: {
                    access_token: 'token',
                    user: { id: 'user-a', email: 'a@example.com', is_anonymous: false },
                },
            },
            error: null,
        });

        await expect(bootstrapAuth(client)).resolves.toMatchObject({
            status: 'authenticated',
            account: { id: 'user-a', email: 'a@example.com' },
        });
        expect(getActiveAccountId()).toBe('user-a');
        await expect(loadRememberedAccount()).resolves.toMatchObject({ id: 'user-a' });
    });

    it('reopens only a remembered account when session bootstrap fails offline', async () => {
        await rememberAuthenticatedAccount({ id: 'user-a', email: 'a@example.com' });
        const client = createClient({
            data: { session: null },
            error: { message: 'Network request failed' },
        });

        await expect(bootstrapAuth(client)).resolves.toMatchObject({
            status: 'offline',
            account: { id: 'user-a' },
        });
        expect(getActiveAccountId()).toBe('user-a');
    });

    it('denies offline reopen for a server-side authentication rejection', async () => {
        await rememberAuthenticatedAccount({ id: 'user-a', email: 'a@example.com' });
        const client = createClient({
            data: { session: null },
            error: { message: 'Invalid Refresh Token: Already Used', name: 'AuthApiError', status: 400 },
        });

        await expect(bootstrapAuth(client)).resolves.toEqual({
            status: 'signed-out', account: null, session: null,
        });
        await expect(loadRememberedAccount()).resolves.toBeNull();
        expect(getActiveAccountId()).toBeNull();
    });

    it('opens the remembered account offline when Supabase is not configured', async () => {
        await rememberAuthenticatedAccount({ id: 'user-a', email: 'a@example.com' });

        // A pure local build (no EXPO_PUBLIC_SUPABASE_URL) can never sign in, so
        // hiding the on-device journal behind the auth screens is not an option.
        await expect(bootstrapAuth(null)).resolves.toMatchObject({
            status: 'offline',
            account: { id: 'user-a' },
        });
        await expect(loadRememberedAccount()).resolves.toMatchObject({ id: 'user-a' });
    });

    it('signs out with no Supabase client when no account was ever remembered', async () => {
        await expect(bootstrapAuth(null)).resolves.toEqual({
            status: 'signed-out', account: null, session: null,
        });
    });

    it('keeps the remembered account offline for an unclassified exception', async () => {
        await rememberAuthenticatedAccount({ id: 'user-a', email: 'a@example.com' });
        const client: AuthBootstrapClient = {
            auth: { getSession: async () => { throw new Error('configuration invalid'); } },
        };

        await expect(bootstrapAuth(client)).resolves.toMatchObject({
            status: 'offline',
            account: { id: 'user-a' },
        });
        await expect(loadRememberedAccount()).resolves.toMatchObject({ id: 'user-a' });
    });

    it('never signs out on a lock acquire abort', async () => {
        await rememberAuthenticatedAccount({ id: 'user-a', email: 'a@example.com' });
        const abort = new Error('signal is aborted without reason');
        abort.name = 'AbortError';
        const client: AuthBootstrapClient = {
            auth: { getSession: async () => { throw abort; } },
        };

        await expect(bootstrapAuth(client)).resolves.toMatchObject({
            status: 'offline',
            account: { id: 'user-a' },
        });
    });

    it('keeps the remembered account when Supabase answers with no session', async () => {
        await rememberAuthenticatedAccount({ id: 'user-a', email: 'a@example.com' });
        const client = createClient({ data: { session: null }, error: null });

        // Expired token + unreachable server makes supabase-js answer exactly like
        // this, so it must not be read as "the user signed out".
        await expect(bootstrapAuth(client)).resolves.toMatchObject({
            status: 'offline',
            account: { id: 'user-a' },
        });
        expect(getActiveAccountId()).toBe('user-a');
    });

    it('still signs out a sessionless answer when no account was ever remembered', async () => {
        const client = createClient({ data: { session: null }, error: null });

        await expect(bootstrapAuth(client)).resolves.toEqual({
            status: 'signed-out', account: null, session: null,
        });
    });

    it('reopens the remembered account when a sessionless event cannot be confirmed offline', async () => {
        await rememberAuthenticatedAccount({ id: 'user-a', email: 'a@example.com' });
        // Cold boot with an expired token while Supabase is unreachable: supabase-js
        // emits INITIAL_SESSION with no session and a retryable refresh failure.
        const client = createClient({
            data: { session: null },
            error: { message: 'Failed to fetch', name: 'AuthRetryableFetchError', status: 0 },
        });

        await expect(resolveAuthSessionEvent(client, 'INITIAL_SESSION', null)).resolves.toEqual({
            type: 'offline',
            account: { id: 'user-a', email: 'a@example.com', lastAuthenticatedAt: expect.any(Number) },
        });
        await expect(loadRememberedAccount()).resolves.toMatchObject({ id: 'user-a' });
    });

    it('treats a signed out event as authoritative without asking the client again', async () => {
        await rememberAuthenticatedAccount({ id: 'user-a', email: 'a@example.com' });
        const client = createClient({
            data: {
                session: {
                    access_token: 'token',
                    user: { id: 'user-a', email: 'a@example.com', is_anonymous: false },
                },
            },
            error: null,
        });

        await expect(resolveAuthSessionEvent(client, 'SIGNED_OUT', null)).resolves.toEqual({
            type: 'signed-out',
        });
        expect(client.auth.getSession).not.toHaveBeenCalled();
    });

    it('signs out a sessionless event when no account was ever remembered', async () => {
        const client = createClient({
            data: { session: null },
            error: { message: 'Failed to fetch', name: 'AuthRetryableFetchError', status: 0 },
        });

        await expect(resolveAuthSessionEvent(client, 'INITIAL_SESSION', null)).resolves.toEqual({
            type: 'signed-out',
        });
    });

    it('reopens the remembered account when a blackholed Supabase never answers the boot probe', async () => {
        jest.useFakeTimers();
        try {
            await rememberAuthenticatedAccount({ id: 'user-a', email: 'a@example.com' });
            const client: AuthBootstrapClient = {
                auth: { getSession: () => new Promise(() => undefined) },
            };

            const pending = bootstrapAuth(client);
            await jest.advanceTimersByTimeAsync(AUTH_BOOTSTRAP_TIMEOUT_MS);

            await expect(pending).resolves.toMatchObject({
                status: 'offline',
                account: { id: 'user-a' },
            });
        } finally {
            jest.useRealTimers();
        }
    });

    it('signs out a blackholed boot probe when no account was ever remembered', async () => {
        jest.useFakeTimers();
        try {
            const client: AuthBootstrapClient = {
                auth: { getSession: () => new Promise(() => undefined) },
            };

            const pending = bootstrapAuth(client);
            await jest.advanceTimersByTimeAsync(AUTH_BOOTSTRAP_TIMEOUT_MS);

            await expect(pending).resolves.toEqual({
                status: 'signed-out', account: null, session: null,
            });
        } finally {
            jest.useRealTimers();
        }
    });
});
