import {
    activateAccount,
    clearActiveAccount,
    getActiveAccountId,
    registerAccountTeardown,
} from '@/services/account/accountRuntime';
import {
    claimLegacyStorageKey,
    claimLegacyStoragePrefix,
    hasLegacyStorage,
    getAccountScopedStorageKey,
    resetAccountStorageAdapter,
    setAccountStorageAdapter,
} from '@/services/account/accountScopedStorage';
import {
    clearRememberedAccount,
    listKnownAccounts,
    loadRememberedAccount,
    rememberAuthenticatedAccount,
    resetAccountRegistryStorageAdapter,
    setAccountRegistryStorageAdapter,
} from '@/services/account/accountRegistry';

interface MemoryStorage {
    readonly values: Map<string, string>;
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    getAllKeys(): Promise<readonly string[]>;
}

function createMemoryStorage(): MemoryStorage {
    const values = new Map<string, string>();
    return {
        values,
        getItem: async (key) => values.get(key) ?? null,
        setItem: async (key, value) => {
            values.set(key, value);
        },
        removeItem: async (key) => {
            values.delete(key);
        },
        getAllKeys: async () => Array.from(values.keys()),
    };
}

describe('account-scoped persistence', () => {
    const storage = createMemoryStorage();

    beforeEach(async () => {
        storage.values.clear();
        setAccountStorageAdapter(storage);
        setAccountRegistryStorageAdapter(storage);
        await clearActiveAccount();
    });

    afterEach(async () => {
        await clearActiveAccount();
        resetAccountStorageAdapter();
        resetAccountRegistryStorageAdapter();
    });

    it('keeps the same owner key isolated across account namespaces', async () => {
        await activateAccount('user-a');
        const userAKey = getAccountScopedStorageKey('@journal_entries');

        await activateAccount('user-b');
        const userBKey = getAccountScopedStorageKey('@journal_entries');

        expect(userAKey).toBe('@blackrose_account:v1:user-a:journal_entries');
        expect(userBKey).toBe('@blackrose_account:v1:user-b:journal_entries');
        expect(userAKey).not.toBe(userBKey);
    });

    it('tears down the previous account before exposing the next one', async () => {
        const observed: (string | null)[] = [];
        const unsubscribe = registerAccountTeardown(async () => {
            observed.push(getActiveAccountId());
        });

        await activateAccount('user-a');
        await activateAccount('user-b');

        expect(observed).toEqual(['user-a']);
        expect(getActiveAccountId()).toBe('user-b');
        unsubscribe();
    });

    it('keeps the current account active when required teardown fails', async () => {
        const unsubscribe = registerAccountTeardown(async () => {
            throw new Error('flush failed');
        });
        await activateAccount('user-a');

        await expect(activateAccount('user-b')).rejects.toThrow('flush failed');
        expect(getActiveAccountId()).toBe('user-a');
        unsubscribe();
    });

    it('claims a legacy key once without overwriting existing account data', async () => {
        storage.values.set('@journal_entries', '{"legacy":true}');
        await activateAccount('user-a');

        await expect(claimLegacyStorageKey('@journal_entries')).resolves.toBe('migrated');
        const scopedKey = getAccountScopedStorageKey('@journal_entries');
        expect(storage.values.get(scopedKey)).toBe('{"legacy":true}');
        expect(storage.values.has('@journal_entries')).toBe(false);

        storage.values.set('@journal_entries', '{"later":true}');
        await expect(claimLegacyStorageKey('@journal_entries')).resolves.toBe('already-owned');
        expect(storage.values.get(scopedKey)).toBe('{"legacy":true}');
        expect(storage.values.has('@journal_entries')).toBe(false);
    });

    it('claims every legacy shard under a prefix without overwriting scoped shards', async () => {
        storage.values.set('@rosebud_session_digest:first', '{"owner":"legacy"}');
        storage.values.set('@rosebud_session_digest:second', '{"owner":"legacy"}');
        await activateAccount('user-a');
        storage.values.set(
            getAccountScopedStorageKey('@rosebud_session_digest:second'),
            '{"owner":"current"}'
        );

        await expect(claimLegacyStoragePrefix('@rosebud_session_digest:')).resolves.toBe(1);
        expect(storage.values.get(
            getAccountScopedStorageKey('@rosebud_session_digest:first')
        )).toBe('{"owner":"legacy"}');
        expect(storage.values.get(
            getAccountScopedStorageKey('@rosebud_session_digest:second')
        )).toBe('{"owner":"current"}');
        expect(storage.values.has('@rosebud_session_digest:first')).toBe(false);
        expect(storage.values.has('@rosebud_session_digest:second')).toBe(false);
    });

    it('detects exact and sharded legacy stores before ownership confirmation', async () => {
        await activateAccount('user-a');
        await expect(hasLegacyStorage(['@rosebud_local_memory'], ['@rosebud_session_digest:']))
            .resolves.toBe(false);
        storage.values.set('@rosebud_session_digest:legacy', '{}');
        await expect(hasLegacyStorage(['@rosebud_local_memory'], ['@rosebud_session_digest:']))
            .resolves.toBe(true);
    });

    it('recovers from a corrupt registry and persists a versioned envelope', async () => {
        storage.values.set('@blackrose_account_registry', '{broken');

        await expect(loadRememberedAccount()).resolves.toBeNull();
        await rememberAuthenticatedAccount({ id: 'user-a', email: 'a@example.com' });

        const persisted = JSON.parse(storage.values.get('@blackrose_account_registry') ?? '{}') as {
            schemaVersion?: number;
        };
        expect(persisted.schemaVersion).toBe(1);
        await expect(loadRememberedAccount()).resolves.toMatchObject({
            id: 'user-a',
            email: 'a@example.com',
        });
    });

    it('serializes concurrent registry updates without dropping an account', async () => {
        await Promise.all([
            rememberAuthenticatedAccount({ id: 'user-a', email: 'a@example.com' }),
            rememberAuthenticatedAccount({ id: 'user-b', email: 'b@example.com' }),
        ]);

        await expect(listKnownAccounts()).resolves.toEqual([
            expect.objectContaining({ id: 'user-a' }),
            expect.objectContaining({ id: 'user-b' }),
        ]);

        await clearRememberedAccount();
        await expect(loadRememberedAccount()).resolves.toBeNull();
    });
});
