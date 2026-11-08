/**
 * A year of writing - pure grid builder.
 *
 * No I/O, no hooks, no clock read inside the builder: the caller passes the
 * end date so the same input always yields the same grid (utils/ stays pure,
 * AGENTS.md rule 3). All dates are LOCAL calendar days via YYYY-MM-DD keys -
 * no UTC shifting, which would move a late-night entry to the wrong square.
 */
import { addLocalDays, getLocalDateKey, parseLocalDateKey } from './date';

/** How much was written that day. 0 = nothing; 4 = a full writing day. */
export type WritingLevel = 0 | 1 | 2 | 3 | 4;

export interface WritingDay {
    readonly dateKey: string;
    readonly level: WritingLevel;
    readonly words: number;
    /** True for padding squares outside the requested window. */
    readonly isPadding: boolean;
    readonly isToday: boolean;
}

export interface WritingYearGrid {
    /** 53 columns x 7 rows, Sunday first, column-major. */
    readonly weeks: readonly (readonly WritingDay[])[];
    /** Month label with the week column index where it first appears. */
    readonly monthLabels: readonly { readonly label: string; readonly weekIndex: number }[];
    readonly weeksCount: number;
    readonly totalDaysWritten: number;
    readonly totalWords: number;
    readonly startDateKey: string;
    readonly endDateKey: string;
}

export const WRITING_YEAR_WEEKS = 53;
export const DAYS_PER_WEEK = 7;

/** Words -> tone step. Thresholds are deliberately gentle for a journal. */
export function writingLevel(words: number): WritingLevel {
    if (words <= 0) return 0;
    if (words < 50) return 1;
    if (words < 150) return 2;
    if (words < 350) return 3;
    return 4;
}

/**
 * Build a trailing 53-week grid ending on the week that contains endDate.
 * wordsByDay is keyed by local YYYY-MM-DD; unknown keys are ignored rather
 * than counted (a corrupt key must not inflate a streak).
 */
export function buildWritingYearGrid(
    wordsByDay: ReadonlyMap<string, number>,
    endDate: Date,
): WritingYearGrid {
    const endWeekday = endDate.getDay();
    // Sunday-first alignment: pad from the Sunday of endDate's week.
    const lastColumnDate = addLocalDays(endDate, DAYS_PER_WEEK - 1 - endWeekday);
    const totalCells = WRITING_YEAR_WEEKS * DAYS_PER_WEEK;
    const firstDate = addLocalDays(lastColumnDate, -(totalCells - 1));

    const endDateKey = getLocalDateKey(endDate);
    const startDateKey = getLocalDateKey(firstDate);

    const weeks: WritingDay[][] = [];
    const monthLabels: { label: string; weekIndex: number }[] = [];
    let lastMonthLabel: string | null = null;
    let totalDaysWritten = 0;
    let totalWords = 0;

    for (let week = 0; week < WRITING_YEAR_WEEKS; week += 1) {
        const column: WritingDay[] = [];
        for (let day = 0; day < DAYS_PER_WEEK; day += 1) {
            const date = addLocalDays(firstDate, week * DAYS_PER_WEEK + day);
            const dateKey = getLocalDateKey(date);
            const inWindow = dateKey >= startDateKey && dateKey <= endDateKey;
            // The last column can reach past today; those squares are padding.
            const isPadding = !inWindow;
            const raw = isPadding ? 0 : (wordsByDay.get(dateKey) ?? 0);
            const words = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
            const level = writingLevel(words);

            if (!isPadding && words > 0) {
                totalDaysWritten += 1;
                totalWords += words;
            }

            column.push({ dateKey, level, words, isPadding, isToday: dateKey === endDateKey });

            // Label a month the first time a real (non-padding) day of it
            // shows in a column. Dec -> Jan must produce a new label.
            if (!isPadding) {
                const label = date.toLocaleDateString('en-US', { month: 'short' });
                if (label !== lastMonthLabel) {
                    monthLabels.push({ label, weekIndex: week });
                    lastMonthLabel = label;
                }
            }
        }
        weeks.push(column);
    }

    return {
        weeks,
        monthLabels,
        weeksCount: WRITING_YEAR_WEEKS,
        totalDaysWritten,
        totalWords,
        startDateKey,
        endDateKey,
    };
}

/** Group a set of written-day keys into a words map with a uniform weight. */
export function wordsByDayFromDayKeys(
    dayKeys: ReadonlySet<string>,
    wordsPerDay = 100,
): Map<string, number> {
    const map = new Map<string, number>();
    for (const key of dayKeys) {
        // Ignore malformed keys instead of displaying a phantom square.
        if (parseLocalDateKey(key)) map.set(key, wordsPerDay);
    }
    return map;
}
