/**
 * Calendar period helpers for Memory v3 rollups (ISO week / month / year).
 * Pure functions — no I/O.
 */

import { addLocalDays, getLocalDateKey, parseLocalDateKey } from '@/utils/date';
import type { MemoryRollupKind } from './memoryRollup.types';

export interface PeriodWindow {
    kind: MemoryRollupKind;
    periodKey: string;
    dateFrom: string;
    dateTo: string;
}

/** ISO week number (1–53) for a local calendar date. */
export function getIsoWeekParts(date: Date): { year: number; week: number } {
    // Thursday of this week determines ISO year (ISO-8601).
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayNr = (target.getDay() + 6) % 7; // Mon=0 … Sun=6
    target.setDate(target.getDate() - dayNr + 3);
    const isoYear = target.getFullYear();
    const firstThursday = new Date(isoYear, 0, 4);
    const firstDayNr = (firstThursday.getDay() + 6) % 7;
    firstThursday.setDate(firstThursday.getDate() - firstDayNr + 3);
    const week = 1 + Math.round(
        (target.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000),
    );
    return { year: isoYear, week };
}

export function formatIsoWeekKey(date: Date): string {
    const { year, week } = getIsoWeekParts(date);
    return `${year}-W${String(week).padStart(2, '0')}`;
}

export function formatMonthKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

export function formatYearKey(date: Date): string {
    return String(date.getFullYear());
}

/** Monday–Sunday window for an ISO week key like 2026-W29. */
export function windowForIsoWeekKey(periodKey: string): PeriodWindow | null {
    const m = /^(\d{4})-W(\d{2})$/.exec(periodKey);
    if (!m) return null;
    const year = Number(m[1]);
    const week = Number(m[2]);
    if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) return null;

    // ISO week 1 contains Jan 4; Monday of that week is the start.
    const jan4 = new Date(year, 0, 4);
    const jan4Day = (jan4.getDay() + 6) % 7;
    const week1Monday = addLocalDays(jan4, -jan4Day);
    const monday = addLocalDays(week1Monday, (week - 1) * 7);
    const sunday = addLocalDays(monday, 6);
    return {
        kind: 'week',
        periodKey,
        dateFrom: getLocalDateKey(monday),
        dateTo: getLocalDateKey(sunday),
    };
}

export function windowForMonthKey(periodKey: string): PeriodWindow | null {
    const m = /^(\d{4})-(\d{2})$/.exec(periodKey);
    if (!m) return null;
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (month < 1 || month > 12) return null;
    const first = new Date(year, month - 1, 1);
    const last = new Date(year, month, 0);
    return {
        kind: 'month',
        periodKey,
        dateFrom: getLocalDateKey(first),
        dateTo: getLocalDateKey(last),
    };
}

export function windowForYearKey(periodKey: string): PeriodWindow | null {
    const m = /^(\d{4})$/.exec(periodKey);
    if (!m) return null;
    const year = Number(m[1]);
    return {
        kind: 'year',
        periodKey,
        dateFrom: `${year}-01-01`,
        dateTo: `${year}-12-31`,
    };
}

export function windowForPeriod(kind: MemoryRollupKind, periodKey: string): PeriodWindow | null {
    if (kind === 'week') return windowForIsoWeekKey(periodKey);
    if (kind === 'month') return windowForMonthKey(periodKey);
    return windowForYearKey(periodKey);
}

/** True when the period's end date is strictly before local today (period closed). */
export function isPeriodClosed(dateTo: string, now: Date = new Date()): boolean {
    const today = getLocalDateKey(now);
    return dateTo < today;
}

export function periodKeyForDate(kind: MemoryRollupKind, dateKey: string): string | null {
    const d = parseLocalDateKey(dateKey);
    if (!d) return null;
    if (kind === 'week') return formatIsoWeekKey(d);
    if (kind === 'month') return formatMonthKey(d);
    return formatYearKey(d);
}
