/**
 * useSelectedDay Hook
 * Manages the selected day state for the Today dashboard weekday selector.
 * Defaults to current day and allows selecting any day of the current week.
 */

import { useCallback, useMemo, useState } from 'react';

export interface DayInfo {
    /** Index 0-6 where 0 = Sunday */
    dayIndex: number;
    /** Short day label (S, M, T, W, T, F, S) */
    label: string;
    /** Full date object */
    date: Date;
    /** Day of month (1-31) */
    dayNumber: number;
    /** Whether this is today */
    isToday: boolean;
}

export interface UseSelectedDayReturn {
    /** Currently selected day info */
    selectedDay: DayInfo;
    /** All days in the current week */
    weekDays: DayInfo[];
    /** Select a specific day by index */
    selectDay: (dayIndex: number) => void;
    /** Formatted date string (e.g., "Sunday, Jan 18th") */
    formattedDate: string;
    /** Month label (e.g., "January") */
    monthLabel: string;
    /** Short date label (e.g., "January 18") */
    shortDateLabel: string;
}

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES_FULL = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

function getOrdinalSuffix(day: number): string {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
}

function getWeekStartDate(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
}

export function useSelectedDay(initialDate?: Date): UseSelectedDayReturn {
    const today = useMemo(() => {
        const d = initialDate ?? new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }, [initialDate]);

    const [selectedIndex, setSelectedIndex] = useState(() => today.getDay());

    const weekDays = useMemo<DayInfo[]>(() => {
        const weekStart = getWeekStartDate(today);
        return Array.from({ length: 7 }, (_, i) => {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + i);
            return {
                dayIndex: i,
                label: DAY_LABELS[i],
                date,
                dayNumber: date.getDate(),
                isToday: date.getTime() === today.getTime(),
            };
        });
    }, [today]);

    const selectedDay = useMemo(() => weekDays[selectedIndex], [weekDays, selectedIndex]);

    const formattedDate = useMemo(() => {
        const day = selectedDay.date.getDate();
        const suffix = getOrdinalSuffix(day);
        const dayName = DAY_NAMES[selectedDay.dayIndex];
        const monthName = MONTH_NAMES_FULL[selectedDay.date.getMonth()];
        return `${dayName}, ${monthName} ${day}${suffix}`;
    }, [selectedDay]);

    const monthLabel = useMemo(
        () => MONTH_NAMES_FULL[selectedDay.date.getMonth()],
        [selectedDay]
    );

    const shortDateLabel = useMemo(() => {
        const monthName = MONTH_NAMES_FULL[selectedDay.date.getMonth()];
        return `${monthName} ${selectedDay.date.getDate()}`;
    }, [selectedDay]);

    const selectDay = useCallback((dayIndex: number) => {
        if (dayIndex >= 0 && dayIndex < 7) {
            setSelectedIndex(dayIndex);
        }
    }, []);

    return {
        selectedDay,
        weekDays,
        selectDay,
        formattedDate,
        monthLabel,
        shortDateLabel,
    };
}
