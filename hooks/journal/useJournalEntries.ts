/**
 * useJournalEntries Hook
 * React hook for accessing and managing journal entries
 * Provides state management and CRUD operations
 */

import {
    createEntry,
    deleteEntry,
    getEntry,
    listCompleted,
    listDrafts,
    listEntries,
    updateEntry,
} from '@/services/journal/journalStorage';
import {
    JournalEntry,
    JournalEntryCreateInput,
    JournalEntryUpdateInput,
} from '@/services/journal/journalStorage.types';
import { useCallback, useEffect, useState } from 'react';

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

export function useJournalEntries(): UseJournalEntriesReturn {
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [drafts, setDrafts] = useState<JournalEntry[]>([]);
    const [completed, setCompleted] = useState<JournalEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [allEntries, draftEntries, completedEntries] = await Promise.all([
                listEntries(),
                listDrafts(),
                listCompleted(),
            ]);
            setEntries(allEntries);
            setDrafts(draftEntries);
            setCompleted(completedEntries);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load entries'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

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
