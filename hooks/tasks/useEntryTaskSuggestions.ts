import { useCallback, useEffect, useRef, useState } from 'react';

import { createGoal, listGoals } from '@/services/goals/goalsStorage';
import { extractTasksForEntry } from '@/services/tasks/taskExtraction';
import { dedupeTasks } from '@/utils/taskExtraction';

interface UseEntryTaskSuggestionsOptions {
    entryId: string | undefined;
    /** The saved words; empty while the entry is still loading. */
    entryText: string;
    /** The day the entry belongs to, so a kept task lands on the right day. */
    dateKey?: string;
    /** Off keeps the request from being sent at all. */
    enabled?: boolean;
}

export interface EntryTaskSuggestions {
    suggestions: string[];
    isLoading: boolean;
    /** Titles the writer kept, so the row can answer "added". */
    kept: string[];
    keep: (title: string) => Promise<void>;
    dismiss: () => void;
    error: string | null;
}

/**
 * Asks once per entry what tasks it implies, and keeps the ones the writer taps.
 *
 * Nothing is written until a tap: the suggestion list is a proposal, and a
 * journal that silently turned sentences into tasks would be putting words in
 * the writer's mouth. A kept task is an ordinary goal, so it appears on Nearby
 * goals and in the goals tools like anything else.
 */
export function useEntryTaskSuggestions({
    entryId,
    entryText,
    dateKey,
    enabled = true,
}: UseEntryTaskSuggestionsOptions): EntryTaskSuggestions {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [kept, setKept] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dismissed, setDismissed] = useState(false);
    const requestedFor = useRef<string | null>(null);

    useEffect(() => {
        if (!enabled || dismissed) return;
        if (!entryId || entryText.trim().length < 24) return;
        if (requestedFor.current === entryId) return;
        requestedFor.current = entryId;
        let cancelled = false;
        setIsLoading(true);

        void (async () => {
            try {
                const existing = (await listGoals()).map((goal) => goal.title);
                const titles = await extractTasksForEntry({ entryText, existing });
                if (cancelled) return;
                setSuggestions(dedupeTasks(existing, titles));
            } catch {
                if (!cancelled) setSuggestions([]);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [dismissed, enabled, entryId, entryText]);

    const keep = useCallback(async (title: string) => {
        setError(null);
        try {
            await createGoal({ title, type: 'goal', dateKey });
            setKept((current) => (current.includes(title) ? current : [...current, title]));
            setSuggestions((current) => current.filter((item) => item !== title));
        } catch {
            setError('Could not add that task. Please try again.');
        }
    }, [dateKey]);

    const dismiss = useCallback(() => {
        setDismissed(true);
        setSuggestions([]);
    }, []);

    return { suggestions, isLoading, kept, keep, dismiss, error };
}
