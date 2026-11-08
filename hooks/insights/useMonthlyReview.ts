/**
 * Feeds the pure month builder from the collections the app has already
 * loaded. No new storage reads (R2 in docs/perf/ui-performance-rules.md).
 * The day list shares ONE useMemo with the review, so tapping a calendar
 * square never triggers another read.
 */
import { useMemo } from 'react';

import { useJournalEntries } from '@/hooks/journal/useJournalEntries';
import { useIntentionCheckIns } from '@/hooks/intentions/useIntentionCheckIns';
import { buildEntryText } from '@/utils/entryText';
import { buildMonthlyReview, type MonthlyWritingRecord } from '@/utils/monthlyReview';
import { buildWritingDayRows, type WritingDayGroup } from '@/utils/writingDayRows';

function countWords(text: string): number {
    const trimmed = text.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
}

export interface UseMonthlyReviewReturn {
    readonly review: ReturnType<typeof buildMonthlyReview>;
    readonly daysByKey: ReadonlyMap<string, WritingDayGroup>;
    readonly isLoading: boolean;
}

export function useMonthlyReview(year: number, month: number): UseMonthlyReviewReturn {
    const { completed: entries, isLoading: entriesLoading } = useJournalEntries();
    const { completed: checkIns, isLoading: checkInsLoading } = useIntentionCheckIns();

    const { review, daysByKey } = useMemo(() => {
        const records: MonthlyWritingRecord[] = [];
        entries.forEach((entry) => {
            const text = buildEntryText(entry.messages);
            records.push({
                id: entry.id,
                createdAt: entry.createdAt,
                text,
                words: countWords(text),
                mood: entry.analysis?.mood,
            });
        });
        checkIns.forEach((checkIn) => {
            const text = [checkIn.title, checkIn.summary].filter(Boolean).join(' ');
            records.push({
                id: checkIn.id,
                createdAt: checkIn.createdAt,
                text,
                words: countWords(text),
                mood: checkIn.mood,
            });
        });
        return {
            review: buildMonthlyReview(records, year, month, new Date()),
            daysByKey: buildWritingDayRows(entries, checkIns),
        };
    }, [entries, checkIns, year, month]);

    return { review, daysByKey, isLoading: entriesLoading || checkInsLoading };
}
