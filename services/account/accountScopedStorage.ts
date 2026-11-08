import AsyncStorage from '@react-native-async-storage/async-storage';
import { getActiveAccountId, runAccountBoundOperation } from './accountRuntime';

export interface AccountStorageAdapter {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    getAllKeys?(): Promise<readonly string[]>;
}

/**
 * Cold-mount read coalescing (Kaneo #81).
 *
 * Expo Router mounts every tab screen at boot, so ~19 collection hooks ask the
 * SAME keys in the same tick (measured 424 storage reads, e.g. goals 31x,
 * local memory 31x). Concurrent readers of one full scoped key share ONE
 * in-flight promise. This is NOT a settled-value cache: the entry is removed
 * as soon as the read settles, so backup restore, demo seed and direct writers
 * cannot be masked by stale data (round 32 reverted a settled cache for exactly
 * this reason). A write/remove invalidates the key too, so a read started after
 * a write can never join a pre-write promise (R5 tap freshness).
 *
 * Module-level on purpose: getStorageForAccount builds a fresh adapter per
 * call, so a per-adapter map would coalesce nothing.
 */
const inFlightReads = new Map<string, Promise<string | null>>();

function readCoalesced(
    adapter: AccountStorageAdapter,
    scopedKey: string,
): Promise<string | null> {
    const pending = inFlightReads.get(scopedKey);
    if (pending) return pending;
    const read = adapter.getItem(scopedKey).finally(() => {
        // Only delete our own entry; a write may have already cleared it.
        if (inFlightReads.get(scopedKey) === read) {
            inFlightReads.delete(scopedKey);
        }
    });
    inFlightReads.set(scopedKey, read);
    return read;
}

function invalidateRead(scopedKey: string): void {
    inFlightReads.delete(scopedKey);
}

export function createAccountScopedStorageAdapter(
    adapter: AccountStorageAdapter,
    accountId: string | null = getActiveAccountId(),
): AccountStorageAdapter {
    return {
        getItem: (key) => readCoalesced(
            adapter,
            getAccountScopedStorageKeyForAccount(key, accountId),
        ),
        setItem: (key, value) => {
            const scopedKey = getAccountScopedStorageKeyForAccount(key, accountId);
            invalidateRead(scopedKey);
            return adapter.setItem(scopedKey, value);
        },
        removeItem: (key) => {
            const scopedKey = getAccountScopedStorageKeyForAccount(key, accountId);
            invalidateRead(scopedKey);
            return adapter.removeItem(scopedKey);
        },
    };
}

export type LegacyClaimResult = 'migrated' | 'missing' | 'already-owned';

let storageAdapter: AccountStorageAdapter = AsyncStorage;
let mutationQueue: Promise<void> = Promise.resolve();

export function setAccountStorageAdapter(adapter: AccountStorageAdapter): void {
    // A new backend must never inherit pending reads from the previous one.
    inFlightReads.clear();
    storageAdapter = adapter;
}

export function resetAccountStorageAdapter(): void {
    inFlightReads.clear();
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
    return getAccountScopedStorageKeyForAccount(ownerKey, getActiveAccountId());
}

export function getAccountScopedStorageKeyForAccount(
    ownerKey: string,
    accountId: string | null,
): string {
    if (!accountId) {
        // Existing unit tests exercise storage owners without mounting the auth
        // bootstrap. Production remains fail-closed; this branch is erased from
        // deployed bundles because NODE_ENV is not "test".
        if (process.env.NODE_ENV === 'test') return ownerKey;
        throw new Error('Account-scoped storage is unavailable before auth bootstrap completes.');
    }
    const encodedAccountId = encodeURIComponent(accountId);
    return `@blackrose_account:v1:${encodedAccountId}:${normalizeOwnerKey(ownerKey)}`;
}

export function getStorageForAccount(accountId: string | null): AccountStorageAdapter {
    return createAccountScopedStorageAdapter(storageAdapter, accountId);
}

export const accountScopedStorage: AccountStorageAdapter = {
    getItem: (ownerKey) => readCoalesced(
        storageAdapter,
        getAccountScopedStorageKey(ownerKey),
    ),
    setItem: (ownerKey, value) => {
        const scopedKey = getAccountScopedStorageKey(ownerKey);
        invalidateRead(scopedKey);
        return storageAdapter.setItem(scopedKey, value);
    },
    removeItem: (ownerKey) => {
        const scopedKey = getAccountScopedStorageKey(ownerKey);
        invalidateRead(scopedKey);
        return storageAdapter.removeItem(scopedKey);
    },
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
    return runAccountBoundOperation('legacy-storage-key-claim', ({ accountId, signal }) => (
        enqueueMutation(async () => {
            const scopedKey = getAccountScopedStorageKeyForAccount(ownerKey, accountId);
            const legacyValue = await ownerStorage.getItem(ownerKey);
            throwIfAccountOperationAborted(signal);
            if (legacyValue === null) {
                return 'missing';
            }

            const currentValue = await ownerStorage.getItem(scopedKey);
            throwIfAccountOperationAborted(signal);
            if (currentValue === null) {
                await ownerStorage.setItem(scopedKey, legacyValue);
                throwIfAccountOperationAborted(signal);
            }
            await ownerStorage.removeItem(ownerKey);
            return currentValue === null ? 'migrated' : 'already-owned';
        })
    ));
}

export function claimLegacyStoragePrefix(
    ownerKeyPrefix: string,
    ownerStorage: AccountStorageAdapter = storageAdapter
): Promise<number> {
    return runAccountBoundOperation('legacy-storage-prefix-claim', ({ accountId, signal }) => (
        enqueueMutation(async () => {
            if (!ownerStorage.getAllKeys) {
                throw new Error('Legacy sharded storage migration requires key enumeration.');
            }
            const keys = await ownerStorage.getAllKeys();
            throwIfAccountOperationAborted(signal);
            const legacyKeys = keys.filter((key) => key.startsWith(ownerKeyPrefix));
            let migrated = 0;
            for (const legacyKey of legacyKeys) {
                const value = await ownerStorage.getItem(legacyKey);
                throwIfAccountOperationAborted(signal);
                if (value === null) continue;
                const scopedKey = getAccountScopedStorageKeyForAccount(legacyKey, accountId);
                if (await ownerStorage.getItem(scopedKey) === null) {
                    throwIfAccountOperationAborted(signal);
                    await ownerStorage.setItem(scopedKey, value);
                    throwIfAccountOperationAborted(signal);
                    migrated += 1;
                }
                await ownerStorage.removeItem(legacyKey);
            }
            return migrated;
        })
    ));
}

function throwIfAccountOperationAborted(signal: AbortSignal): void {
    if (signal.aborted) {
        throw new Error('Account operation was aborted.');
    }
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
