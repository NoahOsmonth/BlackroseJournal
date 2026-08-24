import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireActiveAccountId } from './accountRuntime';

export interface AccountStorageAdapter {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
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
    const accountId = encodeURIComponent(requireActiveAccountId());
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
