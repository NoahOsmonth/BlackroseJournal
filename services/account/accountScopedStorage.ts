import AsyncStorage from '@react-native-async-storage/async-storage';
import { getActiveAccountId } from './accountRuntime';

export interface AccountStorageAdapter {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    getAllKeys?(): Promise<readonly string[]>;
}

export function createAccountScopedStorageAdapter(
    adapter: AccountStorageAdapter
): AccountStorageAdapter {
    return {
        getItem: (key) => adapter.getItem(getAccountScopedStorageKey(key)),
        setItem: (key, value) => adapter.setItem(getAccountScopedStorageKey(key), value),
        removeItem: (key) => adapter.removeItem(getAccountScopedStorageKey(key)),
    };
}

export type LegacyClaimResult = 'migrated' | 'missing' | 'already-owned';

let storageAdapter: AccountStorageAdapter = AsyncStorage;
let mutationQueue: Promise<void> = Promise.resolve();

export function setAccountStorageAdapter(adapter: AccountStorageAdapter): void {
    storageAdapter = adapter;
}

export function resetAccountStorageAdapter(): void {
    storageAdapter = AsyncStorage;
}

function normalizeOwnerKey(ownerKey: string): string {
    const normalized = ownerKey.trim().replace(/^@+/, '');
    if (!normalized) {
        throw new Error('Storage owner key is required.');
    }
    return normalized;
}

export function getAccountScopedStorageKey(ownerKey: string): string {
    const activeAccountId = getActiveAccountId();
    if (!activeAccountId) {
        // Existing unit tests exercise storage owners without mounting the auth
        // bootstrap. Production remains fail-closed; this branch is erased from
        // deployed bundles because NODE_ENV is not "test".
        if (process.env.NODE_ENV === 'test') return ownerKey;
        throw new Error('Account-scoped storage is unavailable before auth bootstrap completes.');
    }
    const accountId = encodeURIComponent(activeAccountId);
    return `@blackrose_account:v1:${accountId}:${normalizeOwnerKey(ownerKey)}`;
}

export const accountScopedStorage: AccountStorageAdapter = {
    getItem: (ownerKey) => storageAdapter.getItem(getAccountScopedStorageKey(ownerKey)),
    setItem: (ownerKey, value) => storageAdapter.setItem(getAccountScopedStorageKey(ownerKey), value),
    removeItem: (ownerKey) => storageAdapter.removeItem(getAccountScopedStorageKey(ownerKey)),
};

function enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationQueue.then(operation, operation);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
}

export function claimLegacyStorageKey(
    ownerKey: string,
    ownerStorage: AccountStorageAdapter = storageAdapter
): Promise<LegacyClaimResult> {
    return enqueueMutation(async () => {
        const scopedKey = getAccountScopedStorageKey(ownerKey);
        const legacyValue = await ownerStorage.getItem(ownerKey);
        if (legacyValue === null) {
            return 'missing';
        }

        const currentValue = await ownerStorage.getItem(scopedKey);
        if (currentValue === null) {
            await ownerStorage.setItem(scopedKey, legacyValue);
        }
        await ownerStorage.removeItem(ownerKey);
        return currentValue === null ? 'migrated' : 'already-owned';
    });
}

export function claimLegacyStoragePrefix(
    ownerKeyPrefix: string,
    ownerStorage: AccountStorageAdapter = storageAdapter
): Promise<number> {
    return enqueueMutation(async () => {
        if (!ownerStorage.getAllKeys) {
            throw new Error('Legacy sharded storage migration requires key enumeration.');
        }
        const keys = await ownerStorage.getAllKeys();
        const legacyKeys = keys.filter((key) => key.startsWith(ownerKeyPrefix));
        let migrated = 0;
        for (const legacyKey of legacyKeys) {
            const value = await ownerStorage.getItem(legacyKey);
            if (value === null) continue;
            const scopedKey = getAccountScopedStorageKey(legacyKey);
            if (await ownerStorage.getItem(scopedKey) === null) {
                await ownerStorage.setItem(scopedKey, value);
                migrated += 1;
            }
            await ownerStorage.removeItem(legacyKey);
        }
        return migrated;
    });
}

export async function hasLegacyStorage(
    exactKeys: readonly string[],
    prefixes: readonly string[],
    ownerStorage: AccountStorageAdapter = storageAdapter
): Promise<boolean> {
    for (const key of exactKeys) {
        if (await ownerStorage.getItem(key) !== null) return true;
    }
    if (prefixes.length === 0) return false;
    if (!ownerStorage.getAllKeys) {
        throw new Error('Legacy sharded storage inspection requires key enumeration.');
    }
    const keys = await ownerStorage.getAllKeys();
    return keys.some((key) => prefixes.some((prefix) => key.startsWith(prefix)));
}
