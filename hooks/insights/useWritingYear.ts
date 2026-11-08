/**
 * Feeds the pure year-grid builder from the journal collections the app has
 * already loaded. No new storage reads: useJournalEntries /
 * useIntentionCheckIns already hold the rows (R2 in ui-performance-rules.md).
 */
import { useMemo } from 'react';

import { useJournalEntries } from '@/hooks/journal/useJournalEntries';
import { useIntentionCheckIns } from '@/hooks/intentions/useIntentionCheckIns';
import { getLocalDateKeyFromTimestamp } from '@/utils/date';
import { buildEntryText } from '@/utils/entryText';
import { buildWritingYearGrid, type WritingYearGrid } from '@/utils/writingYear';

/** Count words in a body without allocating a joined array of all entries. */
function countWords(text: string): number {
    const trimmed = text.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
}

export interface UseWritingYearReturn {
    readonly grid: WritingYearGrid;
    readonly isLoading: boolean;
}

export function useWritingYear(): UseWritingYearReturn {
    const { completed: entries, isLoading: entriesLoading } = useJournalEntries();
    const { completed: checkIns, isLoading: checkInsLoading } = useIntentionCheckIns();

    const grid = useMemo(() => {
        const words = new Map<string, number>();
        const add = (timestamp: number, text: string) => {
            const key = getLocalDateKeyFromTimestamp(timestamp);
            words.set(key, (words.get(key) ?? 0) + countWords(text));
        };
        entries.forEach((entry) => add(entry.createdAt, buildEntryText(entry.messages)));
        checkIns.forEach((checkIn) => {
            add(checkIn.createdAt, [checkIn.title, checkIn.summary].filter(Boolean).join(' '));
        });
        return buildWritingYearGrid(words, new Date());
    }, [entries, checkIns]);

    return { grid, isLoading: entriesLoading || checkInsLoading };
}
