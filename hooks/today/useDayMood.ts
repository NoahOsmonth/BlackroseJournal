/**
 * Today's own read on how the day felt, and what shaped it (Kaneo #98).
 *
 * Reads once on mount, then follows the store's change events so a second
 * surface (or the same one after a reload) cannot disagree with it.
 */
import { useCallback, useEffect, useState } from 'react';

import {
    DayMood,
    clearDayMood,
    listDayMoods,
    setDayMoodFeeling,
    subscribeDayMoods,
    toggleDayFactor,
} from '@/services/journal/dayMood';
import { getLocalDateKey } from '@/utils/date';

export interface UseDayMoodReturn {
    readonly moodId: string | null;
    readonly factorIds: readonly string[];
    readonly setFeeling: (moodId: string) => void;
    readonly toggleFactor: (factorId: string) => void;
    readonly clear: () => void;
}

export function useDayMood(dateKey: string = getLocalDateKey()): UseDayMoodReturn {
    const [entry, setEntry] = useState<DayMood | null>(null);

    useEffect(() => {
        let active = true;
        // Subscribe BEFORE the first read, and ignore the read if a change landed
        // while it was in flight. Without the flag the mount read resolves last
        // and wipes a tap made in the first few hundred milliseconds - measured:
        // the store held 'calm' while the row still showed nothing.
        let sawChange = false;
        const unsubscribe = subscribeDayMoods((days) => {
            sawChange = true;
            if (active) setEntry(days[dateKey] ?? null);
        });
        void listDayMoods().then((days) => {
            if (active && !sawChange) setEntry(days[dateKey] ?? null);
        });
        return () => { active = false; unsubscribe(); };
    }, [dateKey]);

    const setFeeling = useCallback((moodId: string) => {
        // Tapping the feeling already chosen takes it back off.
        const next = entry?.moodId === moodId ? null : moodId;
        void setDayMoodFeeling(dateKey, next);
    }, [dateKey, entry?.moodId]);

    const toggleFactor = useCallback((factorId: string) => {
        void toggleDayFactor(dateKey, factorId);
    }, [dateKey]);

    const clear = useCallback(() => {
        void clearDayMood(dateKey);
    }, [dateKey]);

    return {
        moodId: entry?.moodId ?? null,
        factorIds: entry?.factorIds ?? [],
        setFeeling,
        toggleFactor,
        clear,
    };
}
