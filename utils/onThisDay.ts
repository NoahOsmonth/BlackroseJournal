import { getLocalDateKeyFromTimestamp } from '@/utils/date';

/** The minimum a feed item needs for resurfacing; HistoryItem satisfies it. */
export interface OnThisDayEntry {
    id: string;
    dateKey: string;
    createdAt: number;
    title: string;
    summary: string;
}

export interface OnThisDayPick<T extends OnThisDayEntry = OnThisDayEntry> {
    entry: T;
    /** Whole calendar years between the entry and today. Always >= 1. */
    yearsAgo: number;
    /** Plain wording: "A year ago today", "Two years ago today", ... */
    label: string;
}

const YEAR_WORDS = ['A year', 'Two years', 'Three years', 'Four years', 'Five years'];

function yearsAgoLabel(years: number): string {
    if (years === 1) return 'A year ago today';
    const word = YEAR_WORDS[years - 1] ?? `${years} years`;
    return `${word} ago today`;
}

/**
 * Pick one saved entry written on today's month and day in an earlier year.
 *
 * Pure and local: no storage read, no network, no clock beyond the one passed
 * in. Only earlier years count — an entry written this year is not a memory
 * yet. The oldest match wins (the longest span back in time), and when several
 * entries share that year the latest of them is kept so the row shows the
 * writer's most finished thought of the day. Returns null when nothing
 * qualifies, which is what keeps the row off Today on an empty journal.
 */
export function pickOnThisDay<T extends OnThisDayEntry>(
    entries: readonly T[],
    now: Date | number = new Date(),
): OnThisDayPick<T> | null {
    const todayKey = getLocalDateKeyFromTimestamp(now instanceof Date ? now.getTime() : now);
    const [yearText, monthText, dayText] = todayKey.split('-');
    const todayYear = Number(yearText);
    if (!Number.isFinite(todayYear) || !monthText || !dayText) return null;

    let best: T | null = null;
    let bestYear = Number.POSITIVE_INFINITY;

    for (const entry of entries) {
        if (!entry || typeof entry.dateKey !== 'string') continue;
        const [entryYear, entryMonth, entryDay] = entry.dateKey.split('-');
        if (entryMonth !== monthText || entryDay !== dayText) continue;
        const year = Number(entryYear);
        if (!Number.isFinite(year) || year >= todayYear) continue;
        if (year < bestYear || (year === bestYear && best && entry.createdAt > best.createdAt)) {
            best = entry;
            bestYear = year;
        }
    }

    if (!best) return null;
    const yearsAgo = todayYear - bestYear;
    return { entry: best, yearsAgo, label: yearsAgoLabel(yearsAgo) };
}
