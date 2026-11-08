/**
 * Feeds the pure year-grid builder from the journal collections the app has
 * already loaded. No new storage reads: useJournalEntries /
 * useIntentionCheckIns already hold the rows (R2 in ui-performance-rules.md).
 * Day rows come from the shared pure builder so the month calendar and this
 * grid can never disagree about titles, previews or word counts.
 */
import { useMemo } from 'react';

import { useJournalEntries } from '@/hooks/journal/useJournalEntries';
import { useIntentionCheckIns } from '@/hooks/intentions/useIntentionCheckIns';
import { buildWritingDayRows, type WritingDayGroup, type WritingDayRow } from '@/utils/writingDayRows';
import { buildWritingYearGrid, type WritingYearGrid } from '@/utils/writingYear';

export type { WritingDayRow };

export interface UseWritingYearReturn {
    readonly grid: WritingYearGrid;
    readonly daysByKey: ReadonlyMap<string, WritingDayGroup>;
    readonly isLoading: boolean;
}

export function useWritingYear(): UseWritingYearReturn {
    const { completed: entries, isLoading: entriesLoading } = useJournalEntries();
    const { completed: checkIns, isLoading: checkInsLoading } = useIntentionCheckIns();

    const { grid, daysByKey } = useMemo(() => {
        const days = buildWritingDayRows(entries, checkIns);
        const words = new Map<string, number>();
        for (const [dateKey, day] of days) words.set(dateKey, day.totalWords);
        return { grid: buildWritingYearGrid(words, new Date()), daysByKey: days };
    }, [entries, checkIns]);

    return { grid, daysByKey, isLoading: entriesLoading || checkInsLoading };
}
