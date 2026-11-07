import { useMemo } from 'react';

import { useJournalEntries } from '@/hooks/journal/useJournalEntries';
import { useIntentionCheckIns } from '@/hooks/intentions/useIntentionCheckIns';
import { buildHistoryItems, HistoryItem, toDateKey } from '@/hooks/history/historyUtils';
import { OnThisDayEntry, OnThisDayPick, pickOnThisDay } from '@/utils/onThisDay';
import { getLocalDateKeyFromTimestamp } from '@/utils/date';

/** A feed item stamped with its local calendar day, for date matching only. */
interface DatedHistoryItem extends HistoryItem, OnThisDayEntry {}

interface UseOnThisDayReturn {
    /** Entry from this date in an earlier year, or null when there is none. */
    pick: OnThisDayPick<DatedHistoryItem> | null;
    isLoading: boolean;
}

/**
 * Today's "on this day" memory, read from collections the Today screen has
 * already loaded (journal entries + check-ins). Nothing extra is read from
 * storage and nothing leaves the device; the grouping reuses the same pure
 * item builder the Archive uses, and the calendar day is derived in memory
 * from each item's timestamp.
 */
export function useOnThisDay(): UseOnThisDayReturn {
    const { completed: entries, isLoading: entriesLoading } = useJournalEntries();
    const { completed: checkIns, isLoading: checkInsLoading } = useIntentionCheckIns();

    // Only completed writes resurface: a draft is not a memory yet.
    const items = useMemo<DatedHistoryItem[]>(() => {
        return buildHistoryItems(entries, checkIns).map((item) => ({
            ...item,
            dateKey: toDateKey(item.createdAt) || getLocalDateKeyFromTimestamp(item.createdAt),
        }));
    }, [entries, checkIns]);
    const pick = useMemo(() => pickOnThisDay(items), [items]);

    return { pick, isLoading: entriesLoading || checkInsLoading };
}
