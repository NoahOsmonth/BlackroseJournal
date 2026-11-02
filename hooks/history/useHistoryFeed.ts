import { useCallback, useMemo } from 'react';
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
    draftCount: number;
    isLoading: boolean;
    refresh: () => Promise<void>;
}

export function useHistoryFeed(): UseHistoryFeedReturn {
    const {
        completed,
        drafts,
        isLoading: journalLoading,
        refresh: refreshJournal,
    } = useJournalEntries();
    const {
        completed: checkIns,
        drafts: checkInDrafts,
        isLoading: checkInLoading,
        refresh: refreshCheckIns,
    } = useIntentionCheckIns();

    const items = useMemo(
        () => buildHistoryItems(completed, checkIns),
        [completed, checkIns]
    );
    const sections = useMemo(() => groupHistorySections(items), [items]);
    const weeklySummary = useMemo(() => buildWeeklyHistorySummary(items), [items]);

    // Both collections are already loaded here, so the Archive header's draft
    // badge does not need a second pair of hook instances reading the same keys.
    const draftCount = drafts.length + checkInDrafts.length;

    const refresh = useCallback(async () => {
        await Promise.all([refreshJournal(), refreshCheckIns()]);
    }, [refreshJournal, refreshCheckIns]);

    return {
        sections,
        weeklySummary,
        draftCount,
        isLoading: journalLoading || checkInLoading,
        refresh,
    };
}
