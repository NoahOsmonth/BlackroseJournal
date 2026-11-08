/**
 * A month in review — pure builder.
 *
 * No I/O, no hooks, no clock read. The caller passes the target month and the
 * writing it already loaded. All dates are LOCAL YYYY-MM-DD keys. Reuses the
 * existing theme counter and mood-word cleaner instead of growing a second
 * vocabulary (utils/ stays pure, AGENTS.md rule 3).
 */
import { getLocalDateKey } from './date';
import { plainMoodWord } from './moodStrip';
import { collectWeeklyThemes, type ThemeEntry, type WeeklyTheme } from './thisWeek';

export interface MonthlyWritingRecord {
    readonly id: string;
    readonly createdAt: number;
    readonly text: string;
    readonly words: number;
    readonly mood?: string;
}

export interface MonthlyCalendarDay {
    readonly dateKey: string | null;
    readonly dayNumber: number | null;
    readonly hasWriting: boolean;
    readonly isToday: boolean;
    readonly entryCount: number;
    readonly words: number;
}

export interface MonthlyReview {
    readonly year: number;
    readonly month: number;
    readonly monthLabel: string;
    readonly daysInMonth: number;
    readonly calendar: readonly MonthlyCalendarDay[];
    readonly daysWritten: number;
    readonly totalEntries: number;
    readonly totalWords: number;
    readonly themes: readonly WeeklyTheme[];
    readonly moods: readonly { readonly label: string; readonly days: number }[];
    readonly longestStreak: number;
}

const WEEKDAY_COUNT = 7;

/** Month label with the year, e.g. "November 2026". */
export function formatMonthLabel(year: number, month: number): string {
    // Month here is 1-12 (as callers store it); JS Date wants 0-11.
    const date = new Date(year, month - 1, 1, 12);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** Shift a (year, month) pair by whole months; month is 1-12. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
    const total = year * 12 + (month - 1) + delta;
    return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 + 1 };
}

/**
 * Build the whole review. Records outside the target month are ignored, so a
 * corrupt timestamp cannot invent a square. Padding squares carry a null key.
 * `today` is passed in (not read from a clock) so the same inputs always
 * produce the same result.
 */
export function buildMonthlyReview(
    records: readonly MonthlyWritingRecord[],
    year: number,
    month: number,
    today: Date,
): MonthlyReview {
    const first = new Date(year, month - 1, 1, 12);
    const daysInMonth = new Date(year, month, 0, 12).getDate();
    const monthPrefix = String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-';
    const todayKey = getLocalDateKey(today);

    const byDay = new Map<string, { count: number; words: number; moods: Set<string> }>();
    const themeEntries: ThemeEntry[] = [];
    let totalEntries = 0;
    let totalWords = 0;

    for (const record of records) {
        const dateKey = getLocalDateKey(new Date(record.createdAt));
        if (!dateKey.startsWith(monthPrefix)) continue;
        const words = Number.isFinite(record.words) && record.words > 0 ? Math.floor(record.words) : 0;
        const bucket = byDay.get(dateKey) ?? { count: 0, words: 0, moods: new Set<string>() };
        bucket.count += 1;
        bucket.words += words;
        const mood = plainMoodWord(record.mood);
        if (mood) bucket.moods.add(mood);
        byDay.set(dateKey, bucket);
        totalEntries += 1;
        totalWords += words;
        if (record.text.trim()) themeEntries.push({ dateKey, text: record.text });
    }

    // Sunday-first padding, then one cell per real day.
    const calendar: MonthlyCalendarDay[] = [];
    for (let i = 0; i < first.getDay(); i += 1) {
        calendar.push({ dateKey: null, dayNumber: null, hasWriting: false, isToday: false, entryCount: 0, words: 0 });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
        const dateKey = monthPrefix + String(day).padStart(2, '0');
        const bucket = byDay.get(dateKey);
        calendar.push({
            dateKey,
            dayNumber: day,
            hasWriting: Boolean(bucket),
            isToday: dateKey === todayKey,
            entryCount: bucket?.count ?? 0,
            words: bucket?.words ?? 0,
        });
    }
    // Keep full weeks so the last row does not leave a ragged edge.
    while (calendar.length % WEEKDAY_COUNT !== 0) {
        calendar.push({ dateKey: null, dayNumber: null, hasWriting: false, isToday: false, entryCount: 0, words: 0 });
    }

    // Longest run of consecutive written days inside this month only.
    let longestStreak = 0;
    let run = 0;
    for (let day = 1; day <= daysInMonth; day += 1) {
        const key = monthPrefix + String(day).padStart(2, '0');
        if (byDay.has(key)) { run += 1; longestStreak = Math.max(longestStreak, run); }
        else run = 0;
    }

    // Mood words counted by DISTINCT DAYS, not by mentions, so one long entry
    // with a repeated mood cannot drown the month.
    const moodDays = new Map<string, Set<string>>();
    for (const [dateKey, bucket] of byDay) {
        for (const mood of bucket.moods) {
            const days = moodDays.get(mood) ?? new Set<string>();
            days.add(dateKey);
            moodDays.set(mood, days);
        }
    }
    const moods = [...moodDays.entries()]
        .map(([label, days]) => ({ label, days: days.size }))
        .sort((a, b) => b.days - a.days || a.label.localeCompare(b.label))
        .slice(0, 5);

    return {
        year,
        month,
        monthLabel: formatMonthLabel(year, month),
        daysInMonth,
        calendar,
        daysWritten: byDay.size,
        totalEntries,
        totalWords,
        themes: collectWeeklyThemes(themeEntries, daysInMonth).themes,
        moods,
        longestStreak,
    };
}
