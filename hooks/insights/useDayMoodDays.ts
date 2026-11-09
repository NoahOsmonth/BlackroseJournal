/**
 * The stored day feelings, for anything on Insights that reads them.
 *
 * Subscribe BEFORE the first read and let an in-flight read stand down if a
 * change already landed: that race wiped a fresh tap in round 57.
 */
import { useEffect, useState } from 'react';

import { DayMood, listDayMoods, subscribeDayMoods } from '@/services/journal/dayMood';

export function useDayMoodDays(): Record<string, DayMood> {
    const [days, setDays] = useState<Record<string, DayMood>>({});

    useEffect(() => {
        let active = true;
        let sawChange = false;
        const unsubscribe = subscribeDayMoods((next) => {
            sawChange = true;
            if (active) setDays(next);
        });
        void listDayMoods().then((next) => {
            if (active && !sawChange) setDays(next);
        });
        return () => { active = false; unsubscribe(); };
    }, []);

    return days;
}
