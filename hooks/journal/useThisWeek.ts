import { useCallback, useEffect, useState } from 'react';
import { listEntries } from '@/services/journal/journalStorage';
import { buildEntryText } from '@/utils/entryText';
import { getLocalDateKey, getLocalDateKeyFromTimestamp } from '@/utils/date';
import { collectWeeklyThemes, weekWindowKeys, type WeekLedger } from '@/utils/thisWeek';
import { useActiveAccountId } from '@/hooks/account/useActiveAccountId';

const EMPTY: WeekLedger = { daysWritten: 0, totalDays: 7, themes: [] };

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
    const accountId = useActiveAccountId();
    const [ledger, setLedger] = useState<WeekLedger>(EMPTY);
    const [isLoading, setIsLoading] = useState(true);

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const window = weekWindowKeys(getLocalDateKey());
            const allowed = new Set(window);
            const all = await listEntries();
            const completed = all.filter((entry) => entry.status !== 'draft');
            const weekEntries = completed
                .map((entry) => ({
                    dateKey: getLocalDateKeyFromTimestamp(entry.createdAt),
                    text: buildEntryText(entry.messages ?? []),
                }))
                .filter((entry) => allowed.has(entry.dateKey) && entry.text.trim().length > 0);
            setLedger(collectWeeklyThemes(weekEntries, window.length));
        } catch {
            setLedger(EMPTY);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!accountId) {
            setLedger(EMPTY);
            setIsLoading(false);
            return;
        }
        void load();
    }, [accountId, load]);

    return { ledger, isLoading, refresh: load };
}
