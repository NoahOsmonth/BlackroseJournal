import { useMemo } from 'react';

import { useJournalEntries } from '@/hooks/journal/useJournalEntries';
import { useIntentionCheckIns } from '@/hooks/intentions/useIntentionCheckIns';
import { buildHistoryItems, HistoryItem, toDateKey } from '@/hooks/history/historyUtils';
import { getLocalDateKeyFromTimestamp } from '@/utils/date';
import type { OnThisDayEntry } from '@/utils/onThisDay';
import { buildOnThisDayTimeline, stepOnThisDayDate } from '@/utils/onThisDayTimeline';

/** A feed item stamped with its local calendar day, for date matching only. */
interface DatedHistoryItem extends HistoryItem, OnThisDayEntry {}

export interface UseOnThisDayTimelineReturn {
    /** Every memory from the visited day in earlier years, grouped by year. */
    timeline: ReturnType<typeof buildOnThisDayTimeline<DatedHistoryItem>>;
    isLoading: boolean;
    /** Step the visited day by whole days; the caller owns the selected key. */
    stepDate: (dateKey: string, deltaDays: number) => string;
}

/**
 * Full On This Day view, read from collections the app already loaded.
 * Nothing extra is read from storage and nothing leaves the device; the
 * grouping reuses the same pure item builder the Archive and Today use.
 * One hook instance per collection, one memo for the items, one for the
 * timeline (docs/perf rules R2/R3/R4).
 */
export function useOnThisDayTimeline(dateKey: string): UseOnThisDayTimelineReturn {
    const { completed: entries, isLoading: entriesLoading } = useJournalEntries();
    const { completed: checkIns, isLoading: checkInsLoading } = useIntentionCheckIns();

    // Only completed writes resurface: a draft is not a memory yet.
    const items = useMemo<DatedHistoryItem[]>(() => {
        return buildHistoryItems(entries, checkIns).map((item) => ({
            ...item,
            dateKey: toDateKey(item.createdAt) || getLocalDateKeyFromTimestamp(item.createdAt),
        }));
    }, [entries, checkIns]);

    const timeline = useMemo(
        () => buildOnThisDayTimeline(items, dateKeyToDate(dateKey)),
        [items, dateKey]
    );

    return {
        timeline,
        isLoading: entriesLoading || checkInsLoading,
        stepDate: stepOnThisDayDate,
    };
}

/** Local midnight from a YYYY-MM-DD key; no clock read. */
function dateKeyToDate(dateKey: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey.trim());
    if (!match) return new Date();
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}
