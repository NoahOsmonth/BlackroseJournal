/**
 * A gentle writing goal — pure progress builder.
 *
 * 2026 products advertise a streak that survives rest days (Be Write, Writing
 * Tracker, TrackBear, Fortelling). A blank day is forgiven only when the
 * writer came back to writing within the next week AND while every rolling
 * 7-day window still has rest days left — so rests cannot be stacked forever,
 * days before the habit began are never judged, and a long silence is never
 * mistaken for a holiday. No I/O, no hooks, no clock read: the caller passes
 * the target date. All dates are LOCAL YYYY-MM-DD keys (utils/ stays pure).
 */
import { addLocalDays, getLocalDateKey } from './date';

export interface WritingGoalSettings {
    readonly wordsPerDay: number;
    readonly restDaysPerWeek: number;
}

export interface WritingGoalRecord {
    readonly createdAt: number;
    readonly words: number;
}

export type WritingGoalDayState = 'met' | 'light' | 'rest' | 'missed' | 'pending';

export interface WritingGoalDay {
    readonly dateKey: string;
    readonly dayNumber: number;
    readonly weekday: string;
    readonly words: number;
    readonly state: WritingGoalDayState;
    readonly isToday: boolean;
    readonly streakSafe: boolean;
}

export interface WritingGoalProgress {
    readonly days: readonly WritingGoalDay[];
    readonly currentStreak: number;
    readonly longestStreak: number;
    readonly daysMet: number;
    readonly restDaysUsed: number;
    readonly totalWords: number;
    readonly wordsThisWeek: number;
    readonly restDaysLeftThisWeek: number;
    readonly metToday: boolean;
}

export const WRITING_GOAL_WINDOW_DAYS = 28;
export const DAYS_PER_WEEK = 7;
export const WORD_TARGET_OPTIONS = [50, 100, 250, 500, 750] as const;
export const REST_DAY_OPTIONS = [0, 1, 2, 3] as const;
export const DEFAULT_WRITING_GOAL: WritingGoalSettings = { wordsPerDay: 100, restDaysPerWeek: 2 };

/** Clamp a saved setting to the supported presets, including corrupt values. */
export function normalizeWritingGoalSettings(value: Partial<WritingGoalSettings> | null | undefined): WritingGoalSettings {
    const words = Number(value?.wordsPerDay);
    const rests = Number(value?.restDaysPerWeek);
    const wordsPerDay = WORD_TARGET_OPTIONS.includes(words as typeof WORD_TARGET_OPTIONS[number])
        ? words
        : DEFAULT_WRITING_GOAL.wordsPerDay;
    const restDaysPerWeek = REST_DAY_OPTIONS.includes(rests as typeof REST_DAY_OPTIONS[number])
        ? rests
        : DEFAULT_WRITING_GOAL.restDaysPerWeek;
    return { wordsPerDay, restDaysPerWeek };
}

function dateKeyPlusDays(dateKey: string, delta: number): string {
    const [year, month, day] = dateKey.split('-').map(Number);
    return getLocalDateKey(addLocalDays(new Date(year, (month ?? 1) - 1, day ?? 1, 12), delta));
}

interface GoalCell {
    readonly dateKey: string;
    readonly dayNumber: number;
    readonly weekday: string;
    readonly words: number;
    readonly state: WritingGoalDayState;
    readonly isToday: boolean;
}

/**
 * Build a 28-day progress strip. Today with no words is 'pending' (there is
 * still time to write) and never breaks the streak by itself.
 *
 * Rests are decided NEWEST-FIRST, so a day is a rest only when writing exists
 * in the seven days AFTER it (the writer came back) and fewer than
 * `restDaysPerWeek` rests already fall in its rolling 7-day window. A long
 * trailing silence therefore gets no free rests and the streak reads zero.
 */
export function buildWritingGoalProgress(
    records: readonly WritingGoalRecord[],
    settings: WritingGoalSettings,
    today: Date,
): WritingGoalProgress {
    const safe = normalizeWritingGoalSettings(settings);
    const todayKey = getLocalDateKey(today);
    const target = safe.wordsPerDay;
    const restAllowance = safe.restDaysPerWeek;
    const noon = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);

    const firstKey = dateKeyPlusDays(todayKey, -(WRITING_GOAL_WINDOW_DAYS - 1));
    const wordsByDay = new Map<string, number>();
    for (const record of records) {
        const key = getLocalDateKey(new Date(record.createdAt));
        if (key < firstKey || key > todayKey) continue;
        const words = Number.isFinite(record.words) && record.words > 0 ? Math.floor(record.words) : 0;
        if (words > 0) wordsByDay.set(key, (wordsByDay.get(key) ?? 0) + words);
    }

    // First pass: fixed facts. Blank past days start as 'missed' and may be
    // upgraded to 'rest' by the backwards pass below.
    const cells: GoalCell[] = [];
    for (let offset = WRITING_GOAL_WINDOW_DAYS - 1; offset >= 0; offset -= 1) {
        const cellDate = addLocalDays(noon, -offset);
        const dateKey = getLocalDateKey(cellDate);
        const words = wordsByDay.get(dateKey) ?? 0;
        const isToday = offset === 0;
        let state: WritingGoalDayState;
        if (words >= target) state = 'met';
        else if (words > 0) state = 'light';
        else if (isToday) state = 'pending';
        else state = 'missed';
        cells.push({
            dateKey,
            dayNumber: cellDate.getDate(),
            weekday: cellDate.toLocaleDateString('en-US', { weekday: 'narrow' }),
            words,
            state,
            isToday,
        });
    }

    // Backwards rest pass. restKeys holds newer forgiven dates; checking the
    // window D..D+6 enforces the cap on EVERY rolling 7-day window, not just
    // calendar weeks. Going newest-first means every rest inside that window
    // has already been decided when D is examined.
    const restKeys: string[] = [];
    for (let i = cells.length - 1; i >= 0; i -= 1) {
        const cell = cells[i];
        if (cell.state !== 'missed') continue;
        const windowEnd = dateKeyPlusDays(cell.dateKey, DAYS_PER_WEEK - 1);
        const restsInWindow = restKeys.filter((key) => key >= cell.dateKey && key <= windowEnd).length;
        if (restsInWindow >= restAllowance) continue;
        let cameBack = false;
        for (let ahead = 1; ahead <= DAYS_PER_WEEK && i + ahead < cells.length; ahead += 1) {
            if (cells[i + ahead].words > 0) { cameBack = true; break; }
        }
        if (!cameBack) continue;
        cells[i] = { ...cell, state: 'rest' };
        restKeys.push(cell.dateKey);
    }

    // Streaks come from the FINAL states. Current streak is counted BACKWARDS
    // from today so old misses never erase a live habit; today pending is
    // skipped (still time to write) rather than counted or allowed to break.
    const days: WritingGoalDay[] = cells.map((cell) => ({
        ...cell,
        streakSafe: cell.state !== 'missed',
    }));

    let currentStreak = 0;
    for (let i = days.length - 1; i >= 0; i -= 1) {
        const state = days[i].state;
        if (state === 'pending') continue;
        if (state === 'missed') break;
        currentStreak += 1;
    }

    let longestStreak = 0;
    let running = 0;
    let daysMet = 0;
    let totalWords = 0;
    let wordsThisWeek = 0;
    for (let i = 0; i < days.length; i += 1) {
        const day = days[i];
        if (day.state === 'met') daysMet += 1;
        if (day.state === 'pending') continue;
        if (day.state === 'missed') running = 0;
        else { running += 1; longestStreak = Math.max(longestStreak, running); }
        totalWords += day.words;
        if (i >= days.length - DAYS_PER_WEEK) wordsThisWeek += day.words;
    }

    const restDaysUsed = days.slice(-DAYS_PER_WEEK).filter((day) => day.state === 'rest').length;

    return {
        days,
        currentStreak,
        longestStreak,
        daysMet,
        restDaysUsed,
        totalWords,
        wordsThisWeek,
        restDaysLeftThisWeek: Math.max(0, restAllowance - restDaysUsed),
        metToday: (wordsByDay.get(todayKey) ?? 0) >= target,
    };
}
