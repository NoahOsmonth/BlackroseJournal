/**
 * The day-feeling summary for Insights (Kaneo #99).
 *
 * Same shape as useDayMood: subscribe before the first read, and let an in-flight
 * read stand down if a change already landed. That race wiped a fresh tap in
 * round 57; it would silently show stale counts here.
 */
import { useEffect, useMemo, useState } from 'react';

import { DayMood, listDayMoods, subscribeDayMoods } from '@/services/journal/dayMood';
import { getLocalDateKey } from '@/utils/date';
import { buildDayMoodInsight, DayMoodInsight, INSIGHT_WINDOW_DAYS } from '@/utils/dayMoodInsights';

export function useDayMoodInsight(windowDays: number = INSIGHT_WINDOW_DAYS): DayMoodInsight {
    const [days, setDays] = useState<Record<string, DayMood>>({});
    const todayKey = getLocalDateKey();

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

    return useMemo(
        () => buildDayMoodInsight(days, todayKey, windowDays),
        [days, todayKey, windowDays],
    );
}
