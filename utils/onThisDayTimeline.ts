/**
 * A full "on this day" timeline: every entry from this month/day in EVERY
 * earlier year, grouped by year. Pure — no I/O, no hooks, no clock beyond the
 * Date the caller passes in (AGENTS.md rule 3).
 *
 * 2026 research: Day One's On This Day view re-reads "entries you've written
 * on a day over the years"; a 2026 review calls it "a killer feature for
 * reflection"; Day One Forums asks to filter by multiple years. The app's
 * existing utils/onThisDay.ts deliberately shows only ONE oldest memory on
 * Today, so this builder complements it instead of changing it.
 */
import { getLocalDateKey, getLocalDateKeyFromTimestamp } from '@/utils/date';
import type { OnThisDayEntry } from '@/utils/onThisDay';

export interface OnThisDayYearGroup<T extends OnThisDayEntry> {
    readonly year: number;
    readonly yearsAgo: number;
    /** Plain wording: "A year ago", "Two years ago", ... */
    readonly label: string;
    readonly entries: readonly T[];
}

export interface OnThisDayTimeline<T extends OnThisDayEntry> {
    /** Local YYYY-MM-DD of the day being revisited. */
    readonly dateKey: string;
    /** Plain wording: "November 9" — no year, so past years read cleanly. */
    readonly dateLabel: string;
    /** Newest past year first. Empty when there are no memories. */
    readonly years: readonly OnThisDayYearGroup<T>[];
    /** Total matching entries across all past years. */
    readonly totalMemories: number;
}

const YEAR_WORDS = ['A year', 'Two years', 'Three years', 'Four years', 'Five years'];
const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export function yearsAgoLabel(years: number): string {
    if (years <= 1) return 'A year ago';
    const word = YEAR_WORDS[years - 1] ?? `${years} years`;
    return `${word} ago`;
}

export function formatOnThisDayDate(dateKey: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey.trim());
    if (!match) return dateKey;
    const monthIndex = Number(match[2]) - 1;
    const month = MONTH_NAMES[monthIndex] ?? match[2];
    return `${month} ${Number(match[3])}`;
}

/**
 * Build the timeline for one calendar day. Only STRICTLY earlier years count:
 * an entry written this year is not a memory yet. Every matching entry is
 * kept (not just one), newest-first inside each year; year groups run newest
 * to oldest. A malformed or future date key is ignored rather than throwing.
 */
export function buildOnThisDayTimeline<T extends OnThisDayEntry>(
    entries: readonly T[],
    day: Date | number = new Date(),
): OnThisDayTimeline<T> {
    const date = day instanceof Date ? day : new Date(day);
    const dateKey = day instanceof Date ? getLocalDateKey(date) : getLocalDateKeyFromTimestamp(day);
    const [, monthText, dayText] = dateKey.split('-');
    const currentYear = date.getFullYear();
    const buckets = new Map<number, T[]>();

    entries.forEach((entry) => {
        if (!entry || typeof entry.dateKey !== 'string') return;
        const [yearText, entryMonth, entryDay] = entry.dateKey.split('-');
        if (entryMonth !== monthText || entryDay !== dayText) return;
        const year = Number(yearText);
        if (!Number.isFinite(year) || year >= currentYear) return;
        const bucket = buckets.get(year) ?? [];
        bucket.push(entry);
        buckets.set(year, bucket);
    });

    const years: OnThisDayYearGroup<T>[] = Array.from(buckets.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([year, group]) => ({
            year,
            yearsAgo: currentYear - year,
            label: yearsAgoLabel(currentYear - year),
            entries: [...group].sort((a, b) => b.createdAt - a.createdAt),
        }));

    return {
        dateKey,
        dateLabel: formatOnThisDayDate(dateKey),
        years,
        totalMemories: years.reduce((total, group) => total + group.entries.length, 0),
    };
}

/** Step the revisited day by whole local days; pure, no clock read. */
export function stepOnThisDayDate(dateKey: string, deltaDays: number): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey.trim());
    if (!match) return dateKey;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    date.setDate(date.getDate() + deltaDays);
    return getLocalDateKey(date);
}
