/**
 * Day choices for a letter's unlock date (Kaneo #51).
 *
 * Typing YYYY-MM-DD is easy to get wrong and only gets explained after the
 * fact. This offers quick choices and a month grid; it only ever produces a day
 * key, so utils/letters.ts stays the single source of truth for the date maths.
 *
 * Pure — takes a 'today' key, returns choices. Never reads the clock.
 */

export interface QuickChoice {
    readonly id: string;
    readonly label: string;
    readonly dayKey: string;
}

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseKey(dayKey: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey.trim());
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (Number.isNaN(date.getTime())) return null;
    // Reject impossible days (31 February) that Date silently rolls over.
    if (date.getMonth() !== Number(match[2]) - 1) return null;
    return date;
}

export function toDayKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    next.setDate(next.getDate() + days);
    return next;
}

function addMonths(date: Date, months: number): Date {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const targetMonth = next.getMonth() + months;
    next.setMonth(targetMonth);
    // Setting the month can overflow (31 Jan + 1 month). Clamp to the last day.
    if (next.getMonth() !== ((targetMonth % 12) + 12) % 12) {
        next.setDate(0);
    }
    return next;
}

/** The quick choices offered above the calendar. */
export function quickChoices(todayKey: string): QuickChoice[] {
    const today = parseKey(todayKey);
    if (!today) return [];
    return [
        { id: 'week', label: 'In a week', dayKey: toDayKey(addDays(today, 7)) },
        { id: 'month', label: 'In a month', dayKey: toDayKey(addMonths(today, 1)) },
        { id: 'year', label: 'In a year', dayKey: toDayKey(addMonths(today, 12)) },
    ];
}

export interface CalendarDay {
    /** Empty string for the blank leading cells before the 1st. */
    readonly dayKey: string;
    readonly dayOfMonth: number;
    /** A day already gone cannot be chosen. */
    readonly isPast: boolean;
}

/**
 * One month laid out as weeks, Monday first.
 *
 * Leading blanks keep the 1st under its real weekday, so the grid reads like a
 * wall calendar instead of a run of numbers.
 */
export function monthGrid(year: number, monthIndex: number, todayKey: string): CalendarDay[] {
    const first = new Date(year, monthIndex, 1);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    // getDay(): 0 = Sunday. Shift so Monday is 0.
    const leading = (first.getDay() + 6) % 7;

    const cells: CalendarDay[] = [];
    for (let i = 0; i < leading; i += 1) {
        cells.push({ dayKey: '', dayOfMonth: 0, isPast: false });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
        const dayKey = toDayKey(new Date(year, monthIndex, day));
        cells.push({ dayKey, dayOfMonth: day, isPast: dayKey < todayKey });
    }
    return cells;
}

/** 'November 2026' — the heading above a month grid. */
export function monthLabel(year: number, monthIndex: number): string {
    return `${MONTH_NAMES[monthIndex]} ${year}`;
}

/**
 * The next twelve months, starting with the current one.
 *
 * A letter to your future self is a long-range thing, but a year of months is
 * already more than anyone scrolls; a second year would just be a wall.
 */
export function upcomingMonths(todayKey: string, count = 12): Array<{ year: number; monthIndex: number }> {
    const today = parseKey(todayKey);
    if (!today) return [];
    const months: Array<{ year: number; monthIndex: number }> = [];
    for (let i = 0; i < count; i += 1) {
        const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
        months.push({ year: d.getFullYear(), monthIndex: d.getMonth() });
    }
    return months;
}

/** 'Saturday 9 May 2026' — the chosen day in plain words. */
export function describeDayKey(dayKey: string): string {
    const date = parseKey(dayKey);
    if (!date) return dayKey;
    const day = DAY_NAMES[date.getDay()];
    return `${day} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

/** True when a key is a real calendar day, so the field can refuse nonsense early. */
export function isValidDayKey(dayKey: string): boolean {
    return parseKey(dayKey) !== null;
}
