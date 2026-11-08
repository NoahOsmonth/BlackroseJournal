/**
 * A month in review - pure builder. Fixed dates, no clock read, portable.
 */
import {
    buildMonthlyReview,
    formatMonthLabel,
    shiftMonth,
    type MonthlyWritingRecord,
} from '../../utils/monthlyReview';

const ts = (y: number, m: number, d: number, hour = 12) => new Date(y, m - 1, d, hour).getTime();
const rec = (id: string, t: number, words: number, text = '', mood?: string): MonthlyWritingRecord => ({
    id, createdAt: t, words, text, mood,
});
const today = new Date(2026, 10, 9, 12);

describe('formatMonthLabel / shiftMonth', () => {
    it('names the month with its year', () => {
        expect(formatMonthLabel(2026, 11)).toBe('November 2026');
    });

    it('rolls back over a year boundary', () => {
        expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
        expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
        expect(shiftMonth(2026, 11, -12)).toEqual({ year: 2025, month: 11 });
    });
});

describe('buildMonthlyReview calendar', () => {
    it('builds 30 real days plus Sunday-first padding in November 2026', () => {
        const r = buildMonthlyReview([], 2026, 11, today);
        expect(r.daysInMonth).toBe(30);
        expect(new Date(2026, 10, 1).getDay()).toBe(0);
        expect(r.calendar.filter((d) => d.dateKey !== null)).toHaveLength(30);
        expect(r.calendar.length % 7).toBe(0);
        expect(r.calendar[0].dayNumber).toBe(1);
    });

    it('handles a 31-day month and a 28-day February', () => {
        const oct = buildMonthlyReview([], 2026, 10, today);
        expect(oct.daysInMonth).toBe(31);
        expect(oct.calendar.filter((d) => d.dateKey !== null)).toHaveLength(31);
        const feb = buildMonthlyReview([], 2026, 2, today);
        expect(feb.daysInMonth).toBe(28);
    });

    it('handles leap February with 29 days', () => {
        const leap = buildMonthlyReview([], 2024, 2, today);
        expect(leap.daysInMonth).toBe(29);
        expect(leap.calendar.filter((d) => d.dateKey === '2024-02-29')).toHaveLength(1);
    });

    it('pads before the first weekday and keeps Sunday-first alignment', () => {
        // August 2026 starts on Saturday, so 6 padding squares are needed.
        const r = buildMonthlyReview([], 2026, 8, today);
        expect(r.calendar.slice(0, 6).every((d) => d.dateKey === null)).toBe(true);
        expect(r.calendar[6].dateKey).toBe('2026-08-01');
        const sunday = new Date('2026-08-02T12:00:00').getDay();
        expect(sunday).toBe(0);
    });

    it('marks exactly one today', () => {
        const r = buildMonthlyReview([], 2026, 11, today);
        expect(r.calendar.filter((d) => d.isToday)).toHaveLength(1);
        expect(r.calendar.find((d) => d.isToday)?.dateKey).toBe('2026-11-09');
    });
});

describe('buildMonthlyReview writing', () => {
    it('counts only records inside the target month', () => {
        const r = buildMonthlyReview([
            rec('a', ts(2026, 11, 3), 50, 'sleep again'),
            rec('b', ts(2026, 11, 4), 70, 'sleep again'),
            rec('out', ts(2026, 10, 31), 9999, 'old'),
            rec('future', ts(2026, 12, 1), 9999, 'next'),
        ], 2026, 11, today);
        expect(r.totalEntries).toBe(2);
        expect(r.totalWords).toBe(120);
        expect(r.daysWritten).toBe(2);
        expect(r.calendar.find((d) => d.dateKey === '2026-11-03')?.hasWriting).toBe(true);
        expect(r.calendar.find((d) => d.dateKey === '2026-10-31')).toBeUndefined();
    });

    it('groups several entries on one day', () => {
        const r = buildMonthlyReview([
            rec('a', ts(2026, 11, 3, 9), 20, 'one'),
            rec('b', ts(2026, 11, 3, 21), 30, 'two'),
        ], 2026, 11, today);
        expect(r.daysWritten).toBe(1);
        expect(r.totalEntries).toBe(2);
        expect(r.calendar.find((d) => d.dateKey === '2026-11-03')?.entryCount).toBe(2);
        expect(r.calendar.find((d) => d.dateKey === '2026-11-03')?.words).toBe(50);
    });

    it('counts the longest run of written days inside the month', () => {
        const r = buildMonthlyReview([
            rec('a', ts(2026, 11, 3), 10),
            rec('b', ts(2026, 11, 4), 10),
            rec('c', ts(2026, 11, 5), 10),
            rec('d', ts(2026, 11, 8), 10),
        ], 2026, 11, today);
        expect(r.longestStreak).toBe(3);
    });

    it('counts moods by distinct days and strips emoji', () => {
        const r = buildMonthlyReview([
            rec('a', ts(2026, 11, 3), 10, '', 'Calm 😌'),
            rec('b', ts(2026, 11, 3), 10, '', 'Calm 😌'),
            rec('c', ts(2026, 11, 4), 10, '', 'Tired'),
        ], 2026, 11, today);
        expect(r.moods[0].label).toBe('Calm');
        expect(r.moods[0].days).toBe(1);
        expect(r.moods.some((m) => m.label === 'Calm 😌')).toBe(false);
    });

    it('finds themes that recur on more than one day', () => {
        const r = buildMonthlyReview([
            rec('a', ts(2026, 11, 3), 10, 'sleep sleep and rest'),
            rec('b', ts(2026, 11, 4), 10, 'sleep again'),
        ], 2026, 11, today);
        expect(r.themes.some((t) => t.label === 'sleep' && t.days === 2)).toBe(true);
    });

    it('returns a calm empty month', () => {
        const r = buildMonthlyReview([], 2026, 11, today);
        expect(r.daysWritten).toBe(0);
        expect(r.totalEntries).toBe(0);
        expect(r.totalWords).toBe(0);
        expect(r.moods).toEqual([]);
        expect(r.themes).toEqual([]);
        expect(r.longestStreak).toBe(0);
    });

    it('clamps negative word counts', () => {
        const r = buildMonthlyReview([rec('a', ts(2026, 11, 3), -5)], 2026, 11, today);
        expect(r.totalWords).toBe(0);
    });

    it('is deterministic for the same input', () => {
        const input = [rec('a', ts(2026, 11, 3), 60, 'sleep sleep', 'Calm 😌')];
        expect(buildMonthlyReview(input, 2026, 11, today)).toEqual(buildMonthlyReview(input, 2026, 11, today));
    });
});
