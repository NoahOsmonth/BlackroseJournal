import {
    createAuthCoordinator,
    type AuthCoordinator,
} from '../../../services/auth/authCoordinator';
import {
    clearActiveAccount,
    getActiveAccountId,
} from '../../../services/account/accountRuntime';
import {
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
});
