/**
 * Edit / delete actions for a single journal entry (JOURNAL-10, JOURNAL-11).
 *
 * The screen stays thin: it hands text in and gets a result back. Derived
 * artifact cleanup (atoms, digests, staged memory files) belongs to
 * `services/journal/journalEntryActions`, never to the view.
 */

import { useCallback, useState } from 'react';

import {
    deleteJournalEntryWithTombstone,
    updateJournalEntryText,
} from '@/services/journal/journalEntryActions';
import type { JournalEntry } from '@/services/journal/journalStorage.types';

interface UseJournalEntryActionsReturn {
    isSaving: boolean;
    isDeleting: boolean;
    error: string | null;
    saveText: (entryId: string, text: string) => Promise<JournalEntry | null>;
    remove: (entryId: string) => Promise<boolean>;
    clearError: () => void;
}

function toMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

export function useJournalEntryActions(): UseJournalEntryActionsReturn {
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const saveText = useCallback(async (entryId: string, text: string) => {
        setIsSaving(true);
        setError(null);
        try {
            return await updateJournalEntryText(entryId, text);
        } catch (err) {
            setError(toMessage(err, 'Could not save your edit.'));
            return null;
        } finally {
            setIsSaving(false);
        }
    }, []);

    const remove = useCallback(async (entryId: string) => {
        setIsDeleting(true);
        setError(null);
        try {
            return await deleteJournalEntryWithTombstone(entryId);
        } catch (err) {
            setError(toMessage(err, 'Could not delete this entry.'));
            return false;
        } finally {
            setIsDeleting(false);
        }
    }, []);

    const clearError = useCallback(() => setError(null), []);

    return { isSaving, isDeleting, error, saveText, remove, clearError };
}
