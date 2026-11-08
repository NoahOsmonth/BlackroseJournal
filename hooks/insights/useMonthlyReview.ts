/**
 * Feeds the pure month builder from the collections the app has already
 * loaded. No new storage reads (R2 in docs/perf/ui-performance-rules.md).
 */
import { useMemo } from 'react';

import { useJournalEntries } from '@/hooks/journal/useJournalEntries';
import { useIntentionCheckIns } from '@/hooks/intentions/useIntentionCheckIns';
import { buildEntryText } from '@/utils/entryText';
import { buildMonthlyReview, type MonthlyWritingRecord } from '@/utils/monthlyReview';

function countWords(text: string): number {
    const trimmed = text.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
}

export interface UseMonthlyReviewReturn {
    readonly review: ReturnType<typeof buildMonthlyReview>;
    readonly isLoading: boolean;
}

export function useMonthlyReview(year: number, month: number): UseMonthlyReviewReturn {
    const { completed: entries, isLoading: entriesLoading } = useJournalEntries();
    const { completed: checkIns, isLoading: checkInsLoading } = useIntentionCheckIns();

    const review = useMemo(() => {
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
        return buildMonthlyReview(records, year, month, new Date());
    }, [entries, checkIns, year, month]);

    return { review, isLoading: entriesLoading || checkInsLoading };
}
