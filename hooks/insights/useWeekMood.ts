import { useMemo } from 'react';

import { buildHistoryItems } from '@/hooks/history/historyUtils';
import { useIntentionCheckIns } from '@/hooks/intentions/useIntentionCheckIns';
import { useJournalEntries } from '@/hooks/journal/useJournalEntries';
import { buildWeekMoodStrip, MoodDayCell } from '@/utils/moodStrip';

interface UseWeekMoodReturn {
    cells: MoodDayCell[];
    isLoading: boolean;
}

/**
 * The week's moods, read from collections Insights already loads. Local only:
 * no new storage key, no retry, no AI turn — the mood words were written when
 * each entry was saved.
 */
export function useWeekMood(): UseWeekMoodReturn {
    const { completed: entries, isLoading: entriesLoading } = useJournalEntries();
    const { completed: checkIns, isLoading: checkInsLoading } = useIntentionCheckIns();

    const cells = useMemo(() => {
        const items = buildHistoryItems(entries, checkIns);
        return buildWeekMoodStrip(items);
    }, [entries, checkIns]);

    return { cells, isLoading: entriesLoading || checkInsLoading };
}
