import {
    createAuthCoordinator,
    type AuthCoordinator,
} from '../../../services/auth/authCoordinator';
import {
    clearActiveAccount,
    getActiveAccountId,
    activateAccount,
    registerAccountTeardown,
} from '../../../services/account/accountRuntime';
import {
    loadRememberedAccount,
    rememberAuthenticatedAccount,
    resetAccountRegistryStorageAdapter,
    setAccountRegistryStorageAdapter,
} from '../../../services/account/accountRegistry';
import type { AuthBootstrapClient, AuthSessionLike } from '../../../services/auth/authBootstrap';

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
    return { promise, resolve };
}

describe('auth coordinator', () => {
    let coordinator: AuthCoordinator | null = null;

    beforeEach(async () => {
        const values = new Map<string, string>();
        setAccountRegistryStorageAdapter({
            getItem: async (key) => values.get(key) ?? null,
            setItem: async (key, value) => { values.set(key, value); },
            removeItem: async (key) => { values.delete(key); },
        });
        await clearActiveAccount();
    });

    afterEach(async () => {
        coordinator?.stop();
        coordinator = null;
        await clearActiveAccount();
        resetAccountRegistryStorageAdapter();
    });

    it('lets SIGNED_OUT invalidate a slow bootstrap before bootstrap side effects run', async () => {
        const sessionReady = deferred<{
            data: { session: AuthSessionLike | null };
            error: null;
        }>();
        let authListener: ((event: string, session: AuthSessionLike | null) => void) | null = null;
        const onAuthStateChange = jest.fn((listener) => {
            authListener = listener;
            return { data: { subscription: { unsubscribe: jest.fn() } } };
        });
        const client = {
            auth: {
                getSession: () => sessionReady.promise,
                onAuthStateChange,
            },
        } as unknown as AuthBootstrapClient & {
            auth: { onAuthStateChange: typeof onAuthStateChange };
        };
        coordinator = createAuthCoordinator(client);

        const unsubscribeA = coordinator.subscribe(() => undefined);
        const unsubscribeB = coordinator.subscribe(() => undefined);
        expect(onAuthStateChange).toHaveBeenCalledTimes(1);

        authListener?.('SIGNED_OUT', null);
        sessionReady.resolve({
            data: { session: { user: { id: 'user-a', email: 'a@example.com' } } },
            error: null,
        });
        await coordinator.whenIdle();

        expect(getActiveAccountId()).toBeNull();
        expect(coordinator.getSnapshot().authState.status).toBe('signed-out');
        unsubscribeA();
        unsubscribeB();
    });

    it('keeps the remembered account when a sessionless boot event cannot reach Supabase', async () => {
        await rememberAuthenticatedAccount({ id: 'user-a', email: 'a@example.com' });
        let authListener: ((event: string, session: AuthSessionLike | null) => void) | null = null;
        const onAuthStateChange = jest.fn((listener) => {
            authListener = listener;
            return { data: { subscription: { unsubscribe: jest.fn() } } };
        });
        const client = {
            auth: {
                getSession: async () => ({
                    data: { session: null },
                    error: { message: 'Failed to fetch', name: 'AuthRetryableFetchError', status: 0 },
                }),
                onAuthStateChange,
            },
        } as unknown as AuthBootstrapClient & {
            auth: { onAuthStateChange: typeof onAuthStateChange };
        };
        coordinator = createAuthCoordinator(client);

        coordinator.subscribe(() => undefined);
        authListener?.('INITIAL_SESSION', null);
        await coordinator.whenIdle();

        expect(coordinator.getSnapshot().isLoading).toBe(false);
        expect(coordinator.getSnapshot().authState).toMatchObject({
            status: 'offline',
            account: { id: 'user-a' },
        });
        expect(getActiveAccountId()).toBe('user-a');
        await expect(loadRememberedAccount()).resolves.toMatchObject({ id: 'user-a' });
    });

    it('ends local access on sign out even when the server revoke never happened', async () => {
        await rememberAuthenticatedAccount({ id: 'user-a', email: 'a@example.com' });
        let authListener: ((event: string, session: AuthSessionLike | null) => void) | null = null;
        const onAuthStateChange = jest.fn((listener) => {
            authListener = listener;
            return { data: { subscription: { unsubscribe: jest.fn() } } };
        });
        const client = {
            auth: {
                getSession: async () => ({
                    data: { session: null },
                    error: { message: 'Failed to fetch', name: 'AuthRetryableFetchError', status: 0 },
                }),
                onAuthStateChange,
            },
        } as unknown as AuthBootstrapClient & {
            auth: { onAuthStateChange: typeof onAuthStateChange };
        };
        coordinator = createAuthCoordinator(client);
        coordinator.subscribe(() => undefined);
        authListener?.('INITIAL_SESSION', null);
        await coordinator.whenIdle();
        expect(coordinator.getSnapshot().authState.status).toBe('offline');

        await coordinator.signOutLocally();

        expect(coordinator.getSnapshot()).toEqual({
            authState: { status: 'signed-out', account: null, session: null },
            isLoading: false,
        });
        expect(getActiveAccountId()).toBeNull();
        await expect(loadRememberedAccount()).resolves.toBeNull();
    });

    it('does not let a background refresh revive a local sign out', async () => {
        await rememberAuthenticatedAccount({ id: 'user-a', email: 'a@example.com' });
        let authListener: ((event: string, session: AuthSessionLike | null) => void) | null = null;
        const onAuthStateChange = jest.fn((listener) => {
            authListener = listener;
            return { data: { subscription: { unsubscribe: jest.fn() } } };
        });
        const client = {
            auth: {
                getSession: async () => ({ data: { session: null }, error: null }),
                onAuthStateChange,
            },
        } as unknown as AuthBootstrapClient & {
            auth: { onAuthStateChange: typeof onAuthStateChange };
        };
        const refreshed: AuthSessionLike = { user: { id: 'user-a', email: 'a@example.com' } };
        coordinator = createAuthCoordinator(client);
        coordinator.subscribe(() => undefined);

        await coordinator.signOutLocally();
        authListener?.('TOKEN_REFRESHED', refreshed);
        await coordinator.whenIdle();

        expect(coordinator.getSnapshot().authState.status).toBe('signed-out');
        expect(getActiveAccountId()).toBeNull();

        // A deliberate sign-in is still honoured.
        authListener?.('SIGNED_IN', refreshed);
        await coordinator.whenIdle();

        expect(coordinator.getSnapshot().authState).toMatchObject({
            status: 'authenticated',
            account: { id: 'user-a' },
        });
        expect(getActiveAccountId()).toBe('user-a');
    });

    it('leaves loading state and surfaces a current transition failure without an unhandled chain', async () => {
        await activateAccount('user-old');
        const unregister = registerAccountTeardown(async () => {
            throw new Error('account teardown failed');
        });
        const client = {
            auth: {
                getSession: async () => ({
                    data: { session: { user: { id: 'user-new' } } }, error: null,
                }),
                onAuthStateChange: () => ({
                    data: { subscription: { unsubscribe: jest.fn() } },
                }),
            },
        } as unknown as AuthBootstrapClient & {
            auth: { onAuthStateChange: jest.Mock };
        };
        coordinator = createAuthCoordinator(client);
        coordinator.subscribe(() => undefined);

        await expect(coordinator.whenIdle()).rejects.toThrow('account teardown failed');
        expect(coordinator.getSnapshot().isLoading).toBe(false);
        expect(getActiveAccountId()).toBe('user-old');
        unregister();
    });
});
