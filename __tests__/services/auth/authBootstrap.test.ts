import {
    bootstrapAuth,
    handleAuthSessionChange,
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

    it('does not treat a clean signed-out result as offline access', async () => {
        await rememberAuthenticatedAccount({ id: 'user-a', email: 'a@example.com' });
        const client = createClient({ data: { session: null }, error: null });

        await expect(bootstrapAuth(client)).resolves.toEqual({
            status: 'signed-out',
            account: null,
            session: null,
        });
        expect(getActiveAccountId()).toBeNull();
    });

    it('clears remembered offline access when Supabase emits signed out', async () => {
        await rememberAuthenticatedAccount({ id: 'user-a', email: 'a@example.com' });

        await expect(handleAuthSessionChange(null)).resolves.toEqual({
            status: 'signed-out',
            account: null,
            session: null,
        });
        await expect(loadRememberedAccount()).resolves.toBeNull();
        expect(getActiveAccountId()).toBeNull();
    });
});
