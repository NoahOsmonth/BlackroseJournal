import { useCallback, useMemo } from 'react';
import { useJournalEntries } from '@/hooks/journal/useJournalEntries';
import { useIntentionCheckIns } from '@/hooks/intentions/useIntentionCheckIns';
import {
    buildHistoryItems,
    buildWeeklyHistorySummary,
    createHistorySectionSearch,
    groupHistorySections,
    HistorySection,
    HistorySectionSearch,
    WeeklyHistorySummary,
} from './historyUtils';

interface UseHistoryFeedReturn {
    sections: HistorySection[];
    /** Memoized full-corpus Archive search, bound to `sections`. */
    searchSections: HistorySectionSearch;
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

    // One prepared corpus over the collections loaded above. Rebuilt only when
    // the feed's sections change; a keystroke never re-reads storage, never
    // mounts a second collection hook and never writes a persisted index.
    const searchSections = useMemo(
        () => createHistorySectionSearch(sections),
        [sections]
    );

    // Both collections are already loaded here, so the Archive header's draft
    // badge does not need a second pair of hook instances reading the same keys.
    const draftCount = drafts.length + checkInDrafts.length;

    const refresh = useCallback(async () => {
        await Promise.all([refreshJournal(), refreshCheckIns()]);
    }, [refreshJournal, refreshCheckIns]);

    return {
        sections,
        searchSections,
        weeklySummary,
        draftCount,
        isLoading: journalLoading || checkInLoading,
        refresh,
    };
}
