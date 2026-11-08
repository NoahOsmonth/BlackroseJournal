/**
 * Group already-loaded writing into local calendar days. Pure: no I/O, no
 * hooks, no clock. Callers pass timestamps plus their text/word count.
 */
import { getLocalDateKeyFromTimestamp, isValidIsoDateKey, parseLocalDateKey } from './date';

export interface DayWritingItem<T> {
    readonly id: string;
    readonly createdAt: number;
    readonly words: number;
    readonly title: string;
    readonly value: T;
}

export interface DayWriting<T> {
    readonly dateKey: string;
    readonly items: readonly DayWritingItem<T>[];
    readonly totalWords: number;
}

/**
 * Build a date-key -> day map. Out-of-range days are kept in the map but
 * callers only read the keys the grid exposes, so a corrupt timestamp never
 * invents a visible square. Items are newest-first within each day.
 */
export function groupWritingByDay<T>(items: readonly DayWritingItem<T>[]): Map<string, DayWriting<T>> {
    const byDay = new Map<string, DayWritingItem<T>[]>();
    for (const item of items) {
        const dateKey = getLocalDateKeyFromTimestamp(item.createdAt);
        const bucket = byDay.get(dateKey);
        if (bucket) bucket.push(item);
        else byDay.set(dateKey, [item]);
    }
    const result = new Map<string, DayWriting<T>>();
    for (const [dateKey, bucket] of byDay) {
        bucket.sort((a, b) => b.createdAt - a.createdAt);
        result.set(dateKey, {
            dateKey,
            items: bucket,
            totalWords: bucket.reduce((sum, item) => sum + Math.max(0, item.words), 0),
        });
    }
    return result;
}

/** Plain-language date heading for a YYYY-MM-DD key. */
export function formatWritingDay(dateKey: string): string {
    const date = new Date(dateKey + 'T12:00:00');
    if (Number.isNaN(date.getTime())) return dateKey;
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * A writer may add words to a real day that is not in the future. Corrupt,
 * blank or impossible keys are refused rather than inventing a date.
 * `todayKey` is passed in by the caller — no clock read inside this helper.
 */
export function canWriteOnDay(dateKey: string, todayKey: string): boolean {
    if (typeof dateKey !== 'string' || typeof todayKey !== 'string') return false;
    if (!isValidIsoDateKey(dateKey) || !isValidIsoDateKey(todayKey)) return false;
    return dateKey <= todayKey;
}

/**
 * Midday local on the chosen day, so a timezone edge cannot slip the entry
 * into the day before or after. Today returns undefined: the storage layer's
 * own `now` is already the right answer and must not be overridden.
 * Returns undefined for any refused key as well.
 */
export function backfillCreatedAt(
    dateKey: string,
    todayKey: string,
    now: number,
): number | undefined {
    if (!canWriteOnDay(dateKey, todayKey) || dateKey === todayKey) return undefined;
    const date = parseLocalDateKey(dateKey);
    if (!date) return undefined;
    date.setHours(12, 0, 0, 0);
    const timestamp = date.getTime();
    // A past day cannot be later than the real clock. Guards against a caller
    // passing a stale `todayKey` from a screen left open past midnight.
    return Number.isFinite(timestamp) && timestamp < now ? timestamp : undefined;
}

