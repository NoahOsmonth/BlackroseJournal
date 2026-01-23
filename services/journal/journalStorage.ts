/**
 * Journal Storage Service
 * Handles persistence of journal entries using AsyncStorage
 * Designed with dependency injection for testability
 */

import { ingestJournalEntry } from '@/services/supermemory/supermemory';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    JournalEntry,
    JournalEntryCreateInput,
    JournalEntryUpdateInput,
    StorageAdapter,
} from './journalStorage.types';

const STORAGE_KEY = '@journal_entries';

// Default to AsyncStorage, but allow injection for testing
let storageAdapter: StorageAdapter = AsyncStorage;

export function setStorageAdapter(adapter: StorageAdapter): void {
    storageAdapter = adapter;
}

export function resetStorageAdapter(): void {
    storageAdapter = AsyncStorage;
}

function generateId(): string {
    return `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function getAllEntriesMap(): Promise<Record<string, JournalEntry>> {
    const data = await storageAdapter.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
}

async function saveAllEntries(entries: Record<string, JournalEntry>): Promise<void> {
    await storageAdapter.setItem(STORAGE_KEY, JSON.stringify(entries));
}

/**
 * Create a new journal entry
 */
export async function createEntry(input: JournalEntryCreateInput): Promise<JournalEntry> {
    const now = Date.now();
    const entry: JournalEntry = {
        id: generateId(),
        title: input.title || 'Untitled',
        emoji: input.emoji || '📝',
        messages: input.messages,
        status: input.status,
        createdAt: now,
        updatedAt: now,
    };

    const entries = await getAllEntriesMap();
    entries[entry.id] = entry;
    await saveAllEntries(entries);

    ingestJournalEntry(entry).catch((error) => {
        console.warn('Failed to ingest journal entry to Supermemory:', error);
    });

    return entry;
}

/**
 * Get a single entry by ID
 */
export async function getEntry(id: string): Promise<JournalEntry | null> {
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
    const entries = await getAllEntriesMap();
    const existing = entries[id];

    if (!existing) return null;

    const updated: JournalEntry = {
        ...existing,
        ...input,
        messages: input.messages ?? existing.messages,
        updatedAt: Date.now(),
    };

    entries[id] = updated;
    await saveAllEntries(entries);

    ingestJournalEntry(updated).catch((error) => {
        console.warn('Failed to ingest journal entry to Supermemory:', error);
    });

    return updated;
}

/**
 * Delete an entry by ID
 */
export async function deleteEntry(id: string): Promise<boolean> {
    const entries = await getAllEntriesMap();

    if (!entries[id]) return false;

    delete entries[id];
    await saveAllEntries(entries);

    return true;
}

/**
 * List all entries, optionally filtered by status
 * Returns entries sorted by updatedAt descending (newest first)
 */
export async function listEntries(
    status?: 'draft' | 'completed'
): Promise<JournalEntry[]> {
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

/**
 * Clear all entries (useful for testing)
 */
export async function clearAllEntries(): Promise<void> {
    await storageAdapter.removeItem(STORAGE_KEY);
}

/**
 * Get all entries as a JSON string for export
 */
export async function getAllEntriesForExport(): Promise<string> {
    const list = await listEntries();
    return JSON.stringify(list, null, 2);
}
