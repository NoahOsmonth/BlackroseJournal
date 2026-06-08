import { useMemo } from 'react';
import { useJournalEntries } from '@/hooks/journal/useJournalEntries';
import { useIntentionCheckIns } from '@/hooks/intentions/useIntentionCheckIns';
import {
    buildHistoryItems,
    buildWeeklyHistorySummary,
    groupHistorySections,
    HistorySection,
    WeeklyHistorySummary,
} from './historyUtils';

interface UseHistoryFeedReturn {
    sections: HistorySection[];
    weeklySummary: WeeklyHistorySummary;
    isLoading: boolean;
}

export function useHistoryFeed(): UseHistoryFeedReturn {
    const { completed, isLoading: journalLoading } = useJournalEntries();
    const { completed: checkIns, isLoading: checkInLoading } = useIntentionCheckIns();

    const items = useMemo(
        () => buildHistoryItems(completed, checkIns),
        [completed, checkIns]
    );
    const sections = useMemo(() => groupHistorySections(items), [items]);
    const weeklySummary = useMemo(() => buildWeeklyHistorySummary(items), [items]);

    return {
        sections,
        weeklySummary,
        isLoading: journalLoading || checkInLoading,
    };
}
