import { useCallback, useEffect, useMemo, useState } from 'react';

import { generateStreakHaiku } from '@/services/ai/ai';
import type { JournalEntry } from '@/services/journal/journalStorage.types';
import { calculateCurrentStreak } from '@/utils/streak';

import { useJournalEntries } from '@/hooks/journal/useJournalEntries';

interface UseStreakHaikuState {
    streakCount: number;
    lines: [string, string, string] | null;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

const haikuCache = new Map<string, [string, string, string]>();

function buildEntryText(entry: JournalEntry): string {
    const parts = entry.messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content.trim())
        .filter(Boolean);

    return parts.join('\n\n');
}

export function useStreakHaiku(entryId?: string): UseStreakHaikuState {
    const { completed, getById, isLoading: isEntriesLoading } = useJournalEntries();

    const resolvedEntryId = useMemo(() => {
        if (!entryId) return undefined;
        return Array.isArray(entryId) ? entryId[0] : entryId;
    }, [entryId]);

    const streakCount = useMemo(() => {
        const referenceDate = new Date();
        return calculateCurrentStreak(completed, referenceDate, referenceDate.getTimezoneOffset());
    }, [completed]);

    const [lines, setLines] = useState<[string, string, string] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!resolvedEntryId) {
            setLines(null);
            setError('Missing entryId');
            return;
        }

        const cacheKey = `${resolvedEntryId}:${streakCount}`;
        const cached = haikuCache.get(cacheKey);
        if (cached) {
            setLines(cached);
            setError(null);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const entry = await getById(resolvedEntryId);
            if (!entry) {
                setLines(null);
                setError('Entry not found');
                return;
            }

            const entryText = buildEntryText(entry);
            const result = await generateStreakHaiku({ entryText, streakCount: Math.max(streakCount, 1) });
            haikuCache.set(cacheKey, result);
            setLines(result);
        } catch (e) {
            setLines(null);
            setError(e instanceof Error ? e.message : 'Failed to generate haiku');
        } finally {
            setIsLoading(false);
        }
    }, [getById, resolvedEntryId, streakCount]);

    useEffect(() => {
        if (isEntriesLoading) return;
        load();
    }, [isEntriesLoading, load]);

    return {
        streakCount: Math.max(streakCount, 0),
        lines,
        isLoading: isLoading || isEntriesLoading,
        error,
        refresh: load,
    };
}
