/**
 * useJournalEntries Hook
 * React hook for accessing and managing journal entries
 * Provides state management and CRUD operations
 */

import {
    createEntry,
    deleteEntry,
    getEntry,
    JOURNAL_ENTRIES_SHARD_COUNT,
    JOURNAL_ENTRIES_SHARD_KEY_PREFIX,
    JOURNAL_ENTRIES_STORAGE_KEY,
    listEntries,
    updateEntry,
} from '@/services/journal/journalStorage';
import {
    JournalEntry,
    JournalEntryCreateInput,
    JournalEntryUpdateInput,
} from '@/services/journal/journalStorage.types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useActiveAccountId } from '@/hooks/account/useActiveAccountId';
import { useCollectionRefresh } from '@/hooks/collections/useCollectionRefresh';

interface UseJournalEntriesReturn {
    entries: JournalEntry[];
    drafts: JournalEntry[];
    completed: JournalEntry[];
    isLoading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
    create: (input: JournalEntryCreateInput) => Promise<JournalEntry>;
    update: (id: string, input: JournalEntryUpdateInput) => Promise<JournalEntry | null>;
    remove: (id: string) => Promise<boolean>;
    getById: (id: string) => Promise<JournalEntry | null>;
}

const ENTRY_KEYS = [
    JOURNAL_ENTRIES_STORAGE_KEY,
    ...Array.from({ length: JOURNAL_ENTRIES_SHARD_COUNT }, (_, i) => JOURNAL_ENTRIES_SHARD_KEY_PREFIX + i),
];

export function useJournalEntries(): UseJournalEntriesReturn {
    const accountId = useActiveAccountId();
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [drafts, setDrafts] = useState<JournalEntry[]>([]);
    const [completed, setCompleted] = useState<JournalEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const hasLoadedRef = useRef(false);

    const refresh = useCallback(async () => {
        // Only the first load shows a spinner. A focus refresh must not tear the
        // screen down to a skeleton and back — that swap is the visible stutter.
        if (!hasLoadedRef.current) {
            setIsLoading(true);
        }
        setError(null);
        try {
            // One shard read serves all three lists. `listDrafts`/`listCompleted`
            // each re-read the index and every shard, so asking for all three
            // tripled the parse work for identical data.
            const allEntries = await listEntries();
            setEntries(allEntries);
            setDrafts(allEntries.filter((entry) => entry.status === 'draft'));
            setCompleted(allEntries.filter((entry) => entry.status === 'completed'));
            hasLoadedRef.current = true;
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load entries'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Freshness comes from real writes, not a focus poll (Kaneo #87).
    useCollectionRefresh(ENTRY_KEYS, refresh);

    useEffect(() => {
        if (accountId) {
            // A different account's rows must not be treated as already loaded.
            hasLoadedRef.current = false;
            void refresh();
        } else {
            setEntries([]);
            setDrafts([]);
            setCompleted([]);
            hasLoadedRef.current = false;
            setIsLoading(false);
        }
    }, [accountId, refresh]);

    const create = useCallback(
        async (input: JournalEntryCreateInput): Promise<JournalEntry> => {
            const entry = await createEntry(input);
            await refresh();
            return entry;
        },
        [refresh]
    );

    const update = useCallback(
        async (id: string, input: JournalEntryUpdateInput): Promise<JournalEntry | null> => {
            const entry = await updateEntry(id, input);
            await refresh();
            return entry;
        },
        [refresh]
    );

    const remove = useCallback(
        async (id: string): Promise<boolean> => {
            const success = await deleteEntry(id);
            await refresh();
            return success;
        },
        [refresh]
    );

    const getById = useCallback(async (id: string): Promise<JournalEntry | null> => {
        return getEntry(id);
    }, []);

    return {
        entries,
        drafts,
        completed,
        isLoading,
        error,
        refresh,
        create,
        update,
        remove,
        getById,
    };
}
