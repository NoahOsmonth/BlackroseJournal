import { useMemo } from 'react';
import { useJournalEntries } from '@/hooks/journal/useJournalEntries';
import { useIntentionCheckIns } from '@/hooks/intentions/useIntentionCheckIns';
import { buildHistoryItems, groupHistorySections, HistorySection } from './historyUtils';

interface UseHistoryFeedReturn {
    sections: HistorySection[];
    isLoading: boolean;
}

export function useHistoryFeed(): UseHistoryFeedReturn {
    const { completed, isLoading: journalLoading } = useJournalEntries();
    const { completed: checkIns, isLoading: checkInLoading } = useIntentionCheckIns();

    const sections = useMemo(() => {
        const items = buildHistoryItems(completed, checkIns);
        return groupHistorySections(items);
    }, [completed, checkIns]);

    return {
        sections,
        isLoading: journalLoading || checkInLoading,
    };
}
