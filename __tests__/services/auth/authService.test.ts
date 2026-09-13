import { signOut } from '@/services/auth/authService';
import {
    activateAccount,
    clearActiveAccount,
    getActiveAccountId,
} from '@/services/account/accountRuntime';
import {
    loadRememberedAccount,
    rememberAuthenticatedAccount,
    resetAccountRegistryStorageAdapter,
    setAccountRegistryStorageAdapter,
} from '@/services/account/accountRegistry';

const mockClearStoredAuthSession = jest.fn(async () => undefined);
const mockSignOutAuthCoordinator = jest.fn(async () => undefined);
const mockSignOut = jest.fn(async () => ({ error: null as { message: string } | null }));

// Wrappers, not direct references: jest.mock factories run before these consts
// are initialized, so the lookup has to happen at call time.
jest.mock('@/services/supabase/supabaseClient', () => ({
    getSupabaseClient: () => ({ auth: { signOut: () => mockSignOut() } }),
    clearStoredAuthSession: () => mockClearStoredAuthSession(),
}));

jest.mock('@/services/auth/authCoordinator', () => ({
    signOutAuthCoordinator: () => mockSignOutAuthCoordinator(),
}));

// The real registry runs against an in-memory adapter (see beforeEach); this
// indirection only exists so one test can make a local clear fail.
jest.mock('@/services/account/accountRegistry', () =>
    jest.requireActual('@/services/account/accountRegistry'));

describe('auth service sign out', () => {
    beforeEach(async () => {
        const values = new Map<string, string>();
        setAccountRegistryStorageAdapter({
            getItem: async (key: string) => values.get(key) ?? null,
            setItem: async (key: string, value: string) => {
                values.set(key, value);
            },
            removeItem: async (key: string) => {
                values.delete(key);
            },
        });
        jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        mockClearStoredAuthSession.mockClear();
        mockSignOutAuthCoordinator.mockClear();
        mockSignOut.mockReset();
        await activateAccount('user-a');
        await rememberAuthenticatedAccount({ id: 'user-a', email: 'a@example.com' });
    });

    afterEach(async () => {
        jest.restoreAllMocks();
        await clearActiveAccount();
        resetAccountRegistryStorageAdapter();
    });

    const expectLocalAccessEnded = async () => {
        expect(mockClearStoredAuthSession).toHaveBeenCalledTimes(1);
        expect(mockSignOutAuthCoordinator).toHaveBeenCalledTimes(1);
        await expect(loadRememberedAccount()).resolves.toBeNull();
        expect(getActiveAccountId()).toBeNull();
    };

    it('ends local access when Supabase accepts the sign out', async () => {
        mockSignOut.mockResolvedValue({ error: null });

        await expect(signOut()).resolves.toBeUndefined();

        await expectLocalAccessEnded();
    });

    it('ends local access when the sign out cannot reach Supabase', async () => {
        // Offline with an expired token: supabase-js returns the session error
        // without clearing the session or emitting SIGNED_OUT.
        mockSignOut.mockResolvedValue({ error: { message: 'Failed to fetch' } });

        await expect(signOut()).resolves.toBeUndefined();

        await expectLocalAccessEnded();
    });

    it('ends local access when the sign out call rejects outright', async () => {
        mockSignOut.mockRejectedValue(new Error('lock acquisition timed out'));

        await expect(signOut()).resolves.toBeUndefined();

        await expectLocalAccessEnded();
    });

    it('still drives the signed-out transition when a local clear fails', async () => {
        const registry = jest.requireMock('@/services/account/accountRegistry') as {
            clearRememberedAccount: () => Promise<void>;
        };
        jest.spyOn(registry, 'clearRememberedAccount').mockRejectedValueOnce(new Error('storage full'));
        mockSignOut.mockResolvedValue({ error: null });

        await expect(signOut()).rejects.toThrow('storage full');

        // The coordinator's signed-out transition clears both accounts and is what
        // pulls the UI out of the journal, so it must run regardless.
        expect(mockSignOutAuthCoordinator).toHaveBeenCalledTimes(1);
    });

    it('ends local access when Supabase is not configured at all', async () => {
        const supabaseModule = jest.requireMock('@/services/supabase/supabaseClient') as {
            getSupabaseClient: () => unknown;
        };
        const original = supabaseModule.getSupabaseClient;
        supabaseModule.getSupabaseClient = () => null;
        try {
            await expect(signOut()).resolves.toBeUndefined();
        } finally {
            supabaseModule.getSupabaseClient = original;
        }
        expect(mockSignOut).not.toHaveBeenCalled();

        await expectLocalAccessEnded();
    });
});
