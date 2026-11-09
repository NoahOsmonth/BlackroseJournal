/**
 * The day-feeling summary for Insights (Kaneo #99, lens added in #103).
 *
 * Takes the days rather than reading them: the card already holds one
 * subscription for the strip, and a second one would resolve a tick later and
 * draw the strip empty for a frame.
 */
import { useMemo } from 'react';

import { DayMood } from '@/services/journal/dayMood';
import { getLocalDateKey } from '@/utils/date';
import { buildDayMoodInsight, DayMoodInsight, INSIGHT_WINDOW_DAYS } from '@/utils/dayMoodInsights';

export function useDayMoodInsight(
    days: Record<string, DayMood>,
    windowDays: number = INSIGHT_WINDOW_DAYS,
): DayMoodInsight {
    const todayKey = getLocalDateKey();

    return useMemo(
        () => buildDayMoodInsight(days, todayKey, windowDays),
        [days, todayKey, windowDays],
    );
}
