import { useMemo } from 'react';
import { useJournalEntries } from '@/hooks/journal/useJournalEntries';
import { buildEntryText } from '@/utils/entryText';
import { getLocalDateKey, getLocalDateKeyFromTimestamp } from '@/utils/date';
import { collectWeeklyThemes, weekWindowKeys, type WeekLedger } from '@/utils/thisWeek';

/**
 * The last seven days, counted. Kaneo #10.
 *
 * Reads finished journal entries once per mount and hands the counting to the
 * pure `collectWeeklyThemes`. No AI call, no network: the recap is always
 * available, even offline, and never costs a token.
 */
export interface UseThisWeekReturn {
    readonly ledger: WeekLedger;
    readonly isLoading: boolean;
    readonly refresh: () => Promise<void>;
}

export function useThisWeek(): UseThisWeekReturn {
    // Reads the journal through the shared hook, not listEntries() directly.
    // This hook sits under Today via useGuidedPrompts, so a direct read made
    // the Today tab load the whole journal a fourth time (index + 16 shards)
    // just to know how many days were written this week. One read per
    // collection is the budget (docs/perf/ui-performance-rules.md R2/R3).
    const { completed, isLoading, refresh } = useJournalEntries();

    const ledger = useMemo(() => {
        const window = weekWindowKeys(getLocalDateKey());
        const allowed = new Set(window);
        const weekEntries = completed
            .map((entry) => ({
                dateKey: getLocalDateKeyFromTimestamp(entry.createdAt),
                text: buildEntryText(entry.messages ?? []),
            }))
            .filter((entry) => allowed.has(entry.dateKey) && entry.text.trim().length > 0);
        return collectWeeklyThemes(weekEntries, window.length);
    }, [completed]);

    return { ledger, isLoading, refresh };
}

