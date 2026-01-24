import { useMemo } from 'react';
import { useJournalEntries } from '@/hooks/journal/useJournalEntries';
import { useIntentionCheckIns } from '@/hooks/intentions/useIntentionCheckIns';
import { getLocalDateKey } from '@/utils/date';
import { calculateStreakStats } from '@/utils/streakStats';

interface UseStreakStatsReturn {
    dayKeys: Set<string>;
    currentStreak: number;
    longestStreak: number;
    totalDays: number;
}

export function useStreakStats(): UseStreakStatsReturn {
    const { completed: entries } = useJournalEntries();
    const { completed: checkIns } = useIntentionCheckIns();

    const dayKeys = useMemo(() => {
        const keys = new Set<string>();
        entries.forEach((entry) => keys.add(getLocalDateKey(new Date(entry.createdAt))));
        checkIns.forEach((checkIn) => keys.add(getLocalDateKey(new Date(checkIn.createdAt))));
        return keys;
    }, [checkIns, entries]);

    const stats = useMemo(() => calculateStreakStats(dayKeys), [dayKeys]);

    return {
        dayKeys,
        currentStreak: stats.currentStreak,
        longestStreak: stats.longestStreak,
        totalDays: stats.totalDays,
    };
}
