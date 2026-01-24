import { getLocalDateKey } from '@/utils/date';

export interface CalendarDay {
    date: Date | null;
    hasEntry: boolean;
}

export interface StreakStats {
    currentStreak: number;
    longestStreak: number;
    totalDays: number;
    dayKeys: Set<string>;
}

function keyToUtcTimestamp(key: string): number {
    const [year, month, day] = key.split('-').map(Number);
    return Date.UTC(year, (month ?? 1) - 1, day ?? 1);
}

export function calculateStreakStats(
    dayKeys: Iterable<string>,
    referenceDate: Date = new Date()
): StreakStats {
    const keys = new Set(dayKeys);

    let currentStreak = 0;
    const cursor = new Date(referenceDate);
    cursor.setHours(0, 0, 0, 0);

    while (keys.has(getLocalDateKey(cursor))) {
        currentStreak += 1;
        cursor.setDate(cursor.getDate() - 1);
    }

    const sortedKeys = Array.from(keys).sort((a, b) => keyToUtcTimestamp(a) - keyToUtcTimestamp(b));
    let longestStreak = 0;
    let tempStreak = 0;

    sortedKeys.forEach((key, index) => {
        if (index === 0) {
            tempStreak = 1;
        } else {
            const prevKey = sortedKeys[index - 1];
            const diffDays =
                (keyToUtcTimestamp(key) - keyToUtcTimestamp(prevKey)) / (1000 * 60 * 60 * 24);
            tempStreak = diffDays === 1 ? tempStreak + 1 : 1;
        }
        longestStreak = Math.max(longestStreak, tempStreak);
    });

    return {
        currentStreak,
        longestStreak,
        totalDays: keys.size,
        dayKeys: keys,
    };
}

export function buildCalendarDays(
    dayKeys: Set<string>,
    year: number,
    month: number
): CalendarDay[] {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();

    const days: CalendarDay[] = [];

    for (let i = 0; i < startPadding; i += 1) {
        days.push({ date: null, hasEntry: false });
    }

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
        const date = new Date(year, month, day);
        days.push({
            date,
            hasEntry: dayKeys.has(getLocalDateKey(date)),
        });
    }

    return days;
}
