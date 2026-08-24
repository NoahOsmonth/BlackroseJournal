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
    claimLegacyStorageKey,
    getAccountScopedStorageKey,
} from '@/services/account/accountScopedStorage';
import { registerAccountTeardown } from '@/services/account/accountRuntime';

const STORAGE_KEY = '@journal_entries';

// Default to AsyncStorage, but allow injection for testing
let storageAdapter: StorageAdapter = AsyncStorage;
let hasPulledRemote = false;
let hasPushedLocal = false;
let remoteSyncPromise: Promise<void> | null = null;
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

async function getAllEntriesMap(): Promise<Record<string, JournalEntry>> {
    const data = await storageAdapter.getItem(getAccountScopedStorageKey(STORAGE_KEY));
    if (!data) return {};
    try {
        const parsed = JSON.parse(data) as unknown;
        return parsed && typeof parsed === 'object'
            ? parsed as Record<string, JournalEntry>
            : {};
    } catch {
        return {};
    }
}

async function saveAllEntries(entries: Record<string, JournalEntry>): Promise<void> {
    await storageAdapter.setItem(
        getAccountScopedStorageKey(STORAGE_KEY),
        JSON.stringify(entries)
    );
}

function withMutationLock<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationQueue.then(operation, operation);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
}

async function syncFromRemoteIfNeeded(): Promise<void> {
    if (remoteSyncPromise) {
        return remoteSyncPromise;
    }

    remoteSyncPromise = (async () => {
        const entries = await getAllEntriesMap();
        const hasLocal = Object.keys(entries).length > 0;

        if (!hasLocal && !hasPulledRemote) {
            const remoteEntries = await fetchRemoteJournalEntries();
            if (remoteEntries !== null) {
                hasPulledRemote = true;
                const merged = mergeEntries(entries, remoteEntries);
                await saveAllEntries(merged);
            }
        }

        if (hasLocal && !hasPushedLocal) {
            try {
                const pushed = await pushJournalEntries(Object.values(entries));
                if (pushed) {
                    hasPushedLocal = true;
                }
            } catch (error) {
                console.warn('Failed to push journal entries:', error);
            }
        }
    })();

    try {
        await remoteSyncPromise;
    } finally {
        remoteSyncPromise = null;
    }
}

/**
 * Create a new journal entry
 */
export async function createEntry(input: JournalEntryCreateInput): Promise<JournalEntry> {
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
        const entries = await getAllEntriesMap();
        entries[entry.id] = entry;
        await saveAllEntries(entries);
    });

    try {
        await queueJournalEntryUpsert(entry);
    } catch (error) {
        console.warn('Failed to queue journal entry sync:', error);
    }

    return entry;
}

/**
 * Get a single entry by ID
 */
export async function getEntry(id: string): Promise<JournalEntry | null> {
    await syncFromRemoteIfNeeded();
    const entries = await getAllEntriesMap();
    return entries[id] || null;
}

/**
 * Update an existing entry
 */
export async function updateEntry(
    id: string,
    input: JournalEntryUpdateInput
): Promise<JournalEntry | null> {
    const updated = await withMutationLock(async () => {
        const entries = await getAllEntriesMap();
        const existing = entries[id];
        if (!existing) return null;

        const next: JournalEntry = {
            ...existing,
            ...input,
            messages: input.messages ?? existing.messages,
            updatedAt: Date.now(),
        };
        entries[id] = next;
        await saveAllEntries(entries);
        return next;
    });

    if (!updated) return null;

    try {
        await queueJournalEntryUpsert(updated);
    } catch (error) {
        console.warn('Failed to queue journal entry sync:', error);
    }

    return updated;
}

/**
 * Delete an entry by ID
 */
export async function deleteEntry(id: string): Promise<boolean> {
    const deleted = await withMutationLock(async () => {
        const entries = await getAllEntriesMap();
        if (!entries[id]) return false;
        delete entries[id];
        await saveAllEntries(entries);
        return true;
    });
    if (!deleted) return false;
    try {
        await queueJournalEntryDelete(id);
    } catch (error) {
        console.warn('Failed to queue journal entry delete:', error);
    }

    return true;
}

/**
 * List all entries, optionally filtered by status
 * Returns entries sorted by updatedAt descending (newest first)
 */
export async function listEntries(
    status?: 'draft' | 'completed'
): Promise<JournalEntry[]> {
    await syncFromRemoteIfNeeded();
    const entries = await getAllEntriesMap();
    let list = Object.values(entries);

    if (status) {
        list = list.filter((e) => e.status === status);
    }

    // Sort by updatedAt descending
    list.sort((a, b) => b.updatedAt - a.updatedAt);

    return list;
}

/**
 * List only draft entries
 */
export async function listDrafts(): Promise<JournalEntry[]> {
    return listEntries('draft');
}

/**
 * List only completed entries
 */
export async function listCompleted(): Promise<JournalEntry[]> {
    return listEntries('completed');
}

export async function clearAllEntries(): Promise<void> {
    const entries = await getAllEntriesMap();
    const entryIds = Object.keys(entries);

    if (entryIds.length > 0) {
        try {
            await deleteRemoteJournalEntries(entryIds);
        } catch (error) {
            console.warn('Failed to delete remote journal entries:', error);
        }
    }

    await Promise.all(entryIds.map(async (entryId) => {
        try {
            await queueJournalEntryDelete(entryId);
        } catch (error) {
            console.warn('Failed to queue journal entry delete:', error);
        }
    }));

    await withMutationLock(() => storageAdapter.removeItem(
        getAccountScopedStorageKey(STORAGE_KEY)
    ));

    try {
        await removeSyncTasksForTable(JOURNAL_TABLE);
    } catch (error) {
        console.warn('Failed to remove pending journal sync tasks:', error);
    }

    hasPulledRemote = false;
    hasPushedLocal = false;
}

/**
 * Get all entries as a JSON string for export
 */
export async function getAllEntriesForExport(): Promise<string> {
    const list = await listEntries();
    return JSON.stringify(list, null, 2);
}

export function migrateLegacyJournalEntriesToActiveAccount(): Promise<void> {
    return withMutationLock(async () => {
        await claimLegacyStorageKey(STORAGE_KEY, storageAdapter);
    });
}

export async function hasLegacyJournalEntries(): Promise<boolean> {
    return (await storageAdapter.getItem(STORAGE_KEY)) !== null;
}

export function importJournalEntriesSnapshot(value: string | null): Promise<void> {
    return withMutationLock(async () => {
        if (value === null) {
            await storageAdapter.removeItem(getAccountScopedStorageKey(STORAGE_KEY));
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
        await saveAllEntries(entries);
    });
}

registerAccountTeardown(async () => {
    await mutationQueue;
    if (remoteSyncPromise) {
        await remoteSyncPromise.catch(() => undefined);
    }
    hasPulledRemote = false;
    hasPushedLocal = false;
    remoteSyncPromise = null;
});
