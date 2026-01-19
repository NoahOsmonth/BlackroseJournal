/**
 * Journal Entry Grouping Utilities
 * Functions for grouping entries by week
 */

import { JournalEntry } from '@/services/journalStorage.types';

export interface WeekGroup {
    dateRange: string;
    entries: JournalEntry[];
    startDate: Date;
}

/**
 * Get the start of the week (Sunday) for a given date
 */
function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
}

/**
 * Format a date range string like "May 25th – May 31st, 2025"
 */
function formatDateRange(startDate: Date): string {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    function getOrdinal(n: number): string {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }

    const startMonth = months[startDate.getMonth()];
    const endMonth = months[endDate.getMonth()];
    const startDay = getOrdinal(startDate.getDate());
    const endDay = getOrdinal(endDate.getDate());
    const year = endDate.getFullYear();

    if (startMonth === endMonth) {
        return `${startMonth} ${startDay} – ${endDay}, ${year}`;
    }
    return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
}

/**
 * Group entries by week, returning newest weeks first
 */
export function groupEntriesByWeek(entries: JournalEntry[]): WeekGroup[] {
    const groups: Map<number, WeekGroup> = new Map();

    for (const entry of entries) {
        const weekStart = getWeekStart(new Date(entry.createdAt));
        const key = weekStart.getTime();

        if (!groups.has(key)) {
            groups.set(key, {
                dateRange: formatDateRange(weekStart),
                entries: [],
                startDate: weekStart,
            });
        }

        groups.get(key)!.entries.push(entry);
    }

    // Sort groups by date descending (newest first)
    const sortedGroups = Array.from(groups.values())
        .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());

    // Sort entries within each group by date descending
    for (const group of sortedGroups) {
        group.entries.sort((a, b) => b.createdAt - a.createdAt);
    }

    return sortedGroups;
}
