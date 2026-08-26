/**
 * Journal Storage Service
 * Handles persistence of journal entries using AsyncStorage
 * Designed with dependency injection for testability
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    JournalEntry,
    JournalEntryCreateInput,
    JournalEntryUpdateInput,
    StorageAdapter,
} from './journalStorage.types';
import { removeSyncTasksForTable } from '@/services/supabase/syncQueue';
import {
    deleteRemoteJournalEntries,
    fetchRemoteJournalEntries,
    JOURNAL_TABLE,
    mergeEntries,
    pushJournalEntries,
    queueJournalEntryDelete,
    queueJournalEntryUpsert,
} from './journalRemote';
import {
    AccountStorageAdapter,
    claimLegacyStorageKey,
    createAccountScopedStorageAdapter,
} from '@/services/account/accountScopedStorage';
import {
    AccountOperationContext,
    assertAccountOperationActive,
    registerAccountTeardown,
    runAccountBoundOperation,
} from '@/services/account/accountRuntime';

const STORAGE_KEY = '@journal_entries';

// Default to AsyncStorage, but allow injection for testing.
let storageAdapter: StorageAdapter = AsyncStorage;
let hasPulledRemote = false;
let hasPushedLocal = false;
let remoteSyncPromise: Promise<void> | null = null;
let remoteSyncAccountId: string | null = null;
let mutationQueue: Promise<void> = Promise.resolve();

export function setStorageAdapter(adapter: StorageAdapter): void {
    storageAdapter = adapter;
    hasPulledRemote = false;
    hasPushedLocal = false;
}

export function resetStorageAdapter(): void {
    storageAdapter = AsyncStorage;
    hasPulledRemote = false;
    hasPushedLocal = false;
}

function generateId(): string {
    return `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getStorageForAccount(accountId: string | null): AccountStorageAdapter {
    return createAccountScopedStorageAdapter(storageAdapter, accountId);
}

async function getAllEntriesMap(
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
): Promise<Record<string, JournalEntry>> {
    const data = await storage.getItem(STORAGE_KEY);
    assertAccountOperationActive(context);
    if (!data) return {};
    try {
        const parsed = JSON.parse(data) as unknown;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed as Record<string, JournalEntry>
            : {};
    } catch {
        return {};
    }
}

async function saveAllEntries(
    storage: AccountStorageAdapter,
    entries: Record<string, JournalEntry>,
    context: AccountOperationContext,
): Promise<void> {
    assertAccountOperationActive(context);
    await storage.setItem(STORAGE_KEY, JSON.stringify(entries));
    assertAccountOperationActive(context);
}

function withMutationLock<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationQueue.then(operation, operation);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
}

async function syncFromRemoteIfNeeded(
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
): Promise<void> {
    assertAccountOperationActive(context);
    if (remoteSyncPromise && remoteSyncAccountId === context.accountId) {
        await remoteSyncPromise;
        assertAccountOperationActive(context);
        return;
    }

    const syncAccountId = context.accountId;
    const syncPromise = (async () => {
        const entries = await getAllEntriesMap(storage, context);
        const hasLocal = Object.keys(entries).length > 0;

        if (!hasLocal && !hasPulledRemote) {
            let remoteEntries: JournalEntry[] | null = null;
            try {
                remoteEntries = await fetchRemoteJournalEntries();
                assertAccountOperationActive(context);
            } catch (error) {
                if (context.signal.aborted) throw error;
                console.warn('Failed to fetch remote journal entries:', error);
            }

            if (remoteEntries !== null) {
                await withMutationLock(async () => {
                    assertAccountOperationActive(context);
                    const latestEntries = await getAllEntriesMap(storage, context);
                    const merged = mergeEntries(latestEntries, remoteEntries);
                    await saveAllEntries(storage, merged, context);
                });
                assertAccountOperationActive(context);
                hasPulledRemote = true;
            }
        }

        if (hasLocal && !hasPushedLocal) {
            try {
                assertAccountOperationActive(context);
                const pushed = await pushJournalEntries(Object.values(entries));
                assertAccountOperationActive(context);
                if (pushed) {
                    hasPushedLocal = true;
                }
            } catch (error) {
                if (context.signal.aborted) throw error;
                console.warn('Failed to push journal entries:', error);
            }
        }
    })();

    remoteSyncPromise = syncPromise;
    remoteSyncAccountId = syncAccountId;
    try {
        await syncPromise;
    } finally {
        if (remoteSyncPromise === syncPromise) {
            remoteSyncPromise = null;
            remoteSyncAccountId = null;
        }
    }
}

async function queueJournalEntryUpsertForAccount(
    entry: JournalEntry,
    context: AccountOperationContext,
): Promise<void> {
    try {
        assertAccountOperationActive(context);
        await queueJournalEntryUpsert(entry);
        assertAccountOperationActive(context);
    } catch (error) {
        if (context.signal.aborted) throw error;
        console.warn('Failed to queue journal entry sync:', error);
    }
}

async function queueJournalEntryDeleteForAccount(
    entryId: string,
    context: AccountOperationContext,
): Promise<void> {
    try {
        assertAccountOperationActive(context);
        await queueJournalEntryDelete(entryId);
        assertAccountOperationActive(context);
    } catch (error) {
        if (context.signal.aborted) throw error;
        console.warn('Failed to queue journal entry delete:', error);
    }
}

async function listEntriesForAccount(
    status: 'draft' | 'completed' | undefined,
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
): Promise<JournalEntry[]> {
    await syncFromRemoteIfNeeded(storage, context);
    assertAccountOperationActive(context);
    const entries = await getAllEntriesMap(storage, context);
    let list = Object.values(entries);

    if (status) {
        list = list.filter((entry) => entry.status === status);
    }

    // Sort by updatedAt descending.
    list.sort((a, b) => b.updatedAt - a.updatedAt);
    assertAccountOperationActive(context);
    return list;
}

/**
 * Create a new journal entry.
 */
export function createEntry(input: JournalEntryCreateInput): Promise<JournalEntry> {
    return runAccountBoundOperation('journal-create', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        const now = Date.now();
        const createdAt = typeof input.createdAt === 'number' && Number.isFinite(input.createdAt)
            ? input.createdAt
            : now;
        const updatedAt = typeof input.updatedAt === 'number' && Number.isFinite(input.updatedAt)
            ? input.updatedAt
            : createdAt;
        const entry: JournalEntry = {
            id: generateId(),
            title: input.title || 'Untitled',
            emoji: input.emoji || '📝',
            messages: input.messages,
            status: input.status,
            analysis: input.analysis,
            createdAt,
            updatedAt,
        };

        await withMutationLock(async () => {
            assertAccountOperationActive(context);
            const entries = await getAllEntriesMap(storage, context);
            entries[entry.id] = entry;
            await saveAllEntries(storage, entries, context);
        });
        assertAccountOperationActive(context);
        await queueJournalEntryUpsertForAccount(entry, context);
        assertAccountOperationActive(context);
        return entry;
    });
}

/**
 * Get a single entry by ID.
 */
export function getEntry(id: string): Promise<JournalEntry | null> {
    return runAccountBoundOperation('journal-get', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        await syncFromRemoteIfNeeded(storage, context);
        const entries = await getAllEntriesMap(storage, context);
        assertAccountOperationActive(context);
        return entries[id] || null;
    });
}

/**
 * Update an existing entry.
 */
export function updateEntry(
    id: string,
    input: JournalEntryUpdateInput,
): Promise<JournalEntry | null> {
    return runAccountBoundOperation('journal-update', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        const updated = await withMutationLock(async () => {
            assertAccountOperationActive(context);
            const entries = await getAllEntriesMap(storage, context);
            const existing = entries[id];
            if (!existing) return null;

            const next: JournalEntry = {
                ...existing,
                ...input,
                messages: input.messages ?? existing.messages,
                updatedAt: Date.now(),
            };
            entries[id] = next;
            await saveAllEntries(storage, entries, context);
            return next;
        });

        assertAccountOperationActive(context);
        if (!updated) return null;
        await queueJournalEntryUpsertForAccount(updated, context);
        assertAccountOperationActive(context);
        return updated;
    });
}

/**
 * Delete an entry by ID.
 */
export function deleteEntry(id: string): Promise<boolean> {
    return runAccountBoundOperation('journal-delete', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        const deleted = await withMutationLock(async () => {
            assertAccountOperationActive(context);
            const entries = await getAllEntriesMap(storage, context);
            if (!entries[id]) return false;
            delete entries[id];
            await saveAllEntries(storage, entries, context);
            return true;
        });

        assertAccountOperationActive(context);
        if (!deleted) return false;
        await queueJournalEntryDeleteForAccount(id, context);
        assertAccountOperationActive(context);
        return true;
    });
}

/**
 * List all entries, optionally filtered by status.
 * Returns entries sorted by updatedAt descending (newest first).
 */
export function listEntries(
    status?: 'draft' | 'completed',
): Promise<JournalEntry[]> {
    return runAccountBoundOperation('journal-list', (context) => (
        listEntriesForAccount(status, getStorageForAccount(context.accountId), context)
    ));
}

/**
 * List only draft entries.
 */
export function listDrafts(): Promise<JournalEntry[]> {
    return runAccountBoundOperation('journal-list-drafts', (context) => (
        listEntriesForAccount('draft', getStorageForAccount(context.accountId), context)
    ));
}

/**
 * List only completed entries.
 */
export function listCompleted(): Promise<JournalEntry[]> {
    return runAccountBoundOperation('journal-list-completed', (context) => (
        listEntriesForAccount('completed', getStorageForAccount(context.accountId), context)
    ));
}

export function clearAllEntries(): Promise<void> {
    return runAccountBoundOperation('journal-clear', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        await withMutationLock(async () => {
            assertAccountOperationActive(context);
            const entries = await getAllEntriesMap(storage, context);
            const entryIds = Object.keys(entries);

            if (entryIds.length > 0) {
                try {
                    await deleteRemoteJournalEntries(entryIds);
                    assertAccountOperationActive(context);
                } catch (error) {
                    if (context.signal.aborted) throw error;
                    console.warn('Failed to delete remote journal entries:', error);
                }
            }

            await Promise.all(entryIds.map((entryId) => (
                queueJournalEntryDeleteForAccount(entryId, context)
            )));
            assertAccountOperationActive(context);

            await storage.removeItem(STORAGE_KEY);
            assertAccountOperationActive(context);

            try {
                await removeSyncTasksForTable(JOURNAL_TABLE);
                assertAccountOperationActive(context);
            } catch (error) {
                if (context.signal.aborted) throw error;
                console.warn('Failed to remove pending journal sync tasks:', error);
            }

            hasPulledRemote = false;
            hasPushedLocal = false;
        });
    });
}

/**
 * Get all entries as a JSON string for export.
 */
export function getAllEntriesForExport(): Promise<string> {
    return runAccountBoundOperation('journal-export', async (context) => {
        const list = await listEntriesForAccount(
            undefined,
            getStorageForAccount(context.accountId),
            context,
        );
        assertAccountOperationActive(context);
        return JSON.stringify(list, null, 2);
    });
}

export function migrateLegacyJournalEntriesToActiveAccount(): Promise<void> {
    return runAccountBoundOperation('journal-legacy-migration', async (context) => {
        const ownerStorage = storageAdapter;
        await withMutationLock(async () => {
            assertAccountOperationActive(context);
            await claimLegacyStorageKey(STORAGE_KEY, ownerStorage);
            assertAccountOperationActive(context);
        });
    });
}

export function hasLegacyJournalEntries(): Promise<boolean> {
    return runAccountBoundOperation('journal-legacy-inspection', async (context) => {
        const ownerStorage = storageAdapter;
        const value = await ownerStorage.getItem(STORAGE_KEY);
        assertAccountOperationActive(context);
        return value !== null;
    });
}

export function importJournalEntriesSnapshot(
    value: string | null,
    delegate?: (context: AccountOperationContext) => Promise<void>,
): Promise<void> {
    return runAccountBoundOperation('journal-import', async (context) => {
        await withMutationLock(async () => {
            assertAccountOperationActive(context);
            await (delegate ?? importJournalEntriesForAccount)(context, value);
            assertAccountOperationActive(context);
        });
    });
}

export async function importJournalEntriesForAccount(
    context: AccountOperationContext,
    value: string | null,
): Promise<void> {
    const storage = getStorageForAccount(context.accountId);
    if (value === null) {
        await storage.removeItem(STORAGE_KEY);
        assertAccountOperationActive(context);
        return;
    }
    let entries: Record<string, JournalEntry> = {};
    try {
        const parsed = JSON.parse(value) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            entries = parsed as Record<string, JournalEntry>;
        }
    } catch {
        // Corrupt backup payload restores the owner's safe empty default.
    }
    await saveAllEntries(storage, entries, context);
}

registerAccountTeardown(async () => {
    await mutationQueue;
    if (remoteSyncPromise) {
        await remoteSyncPromise.catch(() => undefined);
    }
    hasPulledRemote = false;
    hasPushedLocal = false;
    remoteSyncPromise = null;
    remoteSyncAccountId = null;
});
