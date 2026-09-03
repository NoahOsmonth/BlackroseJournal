import type { JournalEntry } from '../../services/journal/journalStorage.types';
import { calculateCurrentStreak } from '../../utils/streak';
import {
    buildCalendarDays,
    calculateStreakStats,
} from '../../utils/streakStats';
import { getLocalDateKey } from '../../utils/date';

function entryAt(createdAt: number): JournalEntry {
    return { createdAt } as JournalEntry;
}

describe('calculateCurrentStreak', () => {
    it('counts consecutive UTC days ending on the reference date', () => {
        const ref = new Date('2026-08-22T12:00:00Z');
        const entries = [
            entryAt(new Date('2026-08-20T08:00:00Z').getTime()),
            entryAt(new Date('2026-08-21T08:00:00Z').getTime()),
            entryAt(new Date('2026-08-22T08:00:00Z').getTime()),
        ];
        expect(calculateCurrentStreak(entries, ref)).toBe(3);
    });

    it('stops the streak at the first missing day', () => {
        const ref = new Date('2026-08-22T12:00:00Z');
        const entries = [
            entryAt(new Date('2026-08-20T08:00:00Z').getTime()),
            entryAt(new Date('2026-08-22T08:00:00Z').getTime()),
        ];
        expect(calculateCurrentStreak(entries, ref)).toBe(1);
    });

    it('returns 0 when the reference date itself has no entry', () => {
        const ref = new Date('2026-08-23T12:00:00Z');
        const entries = [
            entryAt(new Date('2026-08-22T08:00:00Z').getTime()),
        ];
        expect(calculateCurrentStreak(entries, ref)).toBe(0);
    });

    it('returns 0 for an empty entry list', () => {
        expect(calculateCurrentStreak([], new Date('2026-08-22T12:00:00Z'))).toBe(0);
    });

    it('ignores duplicate entries on the same day', () => {
        const ref = new Date('2026-08-22T12:00:00Z');
        const entries = [
            entryAt(new Date('2026-08-22T08:00:00Z').getTime()),
            entryAt(new Date('2026-08-22T20:00:00Z').getTime()),
        ];
        expect(calculateCurrentStreak(entries, ref)).toBe(1);
    });

    it('buckets entries by the caller timezone, not UTC', () => {
        // UTC+5 (getTimezoneOffset() === -300): 23:30Z on the 20th is the 21st locally.
        const entries = [entryAt(new Date('2026-08-20T23:30:00Z').getTime())];
        const ref = new Date('2026-08-21T12:00:00Z');
        expect(calculateCurrentStreak(entries, ref, -300)).toBe(1);
        expect(calculateCurrentStreak(entries, ref, 0)).toBe(0);
    });

    it('spans month boundaries', () => {
        const ref = new Date('2026-09-01T12:00:00Z');
        const entries = [
            entryAt(new Date('2026-08-31T08:00:00Z').getTime()),
            entryAt(new Date('2026-09-01T08:00:00Z').getTime()),
        ];
        expect(calculateCurrentStreak(entries, ref)).toBe(2);
    });
});

describe('calculateStreakStats', () => {
    const dayKey = (year: number, month: number, day: number) =>
        getLocalDateKey(new Date(year, month, day));

    it('computes current, longest and total from local day keys', () => {
        const keys = [dayKey(2026, 7, 20), dayKey(2026, 7, 21), dayKey(2026, 7, 22)];
        const stats = calculateStreakStats(keys, new Date(2026, 7, 22, 15, 30));

        expect(stats.currentStreak).toBe(3);
        expect(stats.longestStreak).toBe(3);
        expect(stats.totalDays).toBe(3);
    });

    it('keeps longest streak across a gap while current resets', () => {
        const keys = [
            dayKey(2026, 7, 18),
            dayKey(2026, 7, 19),
            dayKey(2026, 7, 20),
            dayKey(2026, 7, 22),
        ];
        const stats = calculateStreakStats(keys, new Date(2026, 7, 22, 9, 0));

        expect(stats.currentStreak).toBe(1);
        expect(stats.longestStreak).toBe(3);
        expect(stats.totalDays).toBe(4);
    });

    it('is independent of input iteration order', () => {
        const keys = [dayKey(2026, 7, 22), dayKey(2026, 7, 20), dayKey(2026, 7, 21)];
        const stats = calculateStreakStats(keys, new Date(2026, 7, 22, 9, 0));
        expect(stats.longestStreak).toBe(3);
    });

    it('joins consecutive days across a month boundary', () => {
        const keys = [dayKey(2026, 6, 31), dayKey(2026, 7, 1)];
        const stats = calculateStreakStats(keys, new Date(2026, 7, 1, 9, 0));
        expect(stats.longestStreak).toBe(2);
        expect(stats.currentStreak).toBe(2);
    });

    it('handles an empty key set', () => {
        const stats = calculateStreakStats([], new Date(2026, 7, 22, 9, 0));
        expect(stats.currentStreak).toBe(0);
        expect(stats.longestStreak).toBe(0);
        expect(stats.totalDays).toBe(0);
    });
});

describe('buildCalendarDays', () => {
    it('pads to the first weekday and marks entry days', () => {
        // 2026-09-01 is a Tuesday (getDay() === 2).
        const dayKeys = new Set([
            getLocalDateKey(new Date(2026, 8, 5)),
            getLocalDateKey(new Date(2026, 8, 30)),
        ]);
        const days = buildCalendarDays(dayKeys, 2026, 8);

        const padding = new Date(2026, 8, 1).getDay();
        expect(days).toHaveLength(padding + 30);
        expect(days.slice(0, padding).every((day) => day.date === null)).toBe(true);

        const day5 = days[padding + 4];
        expect(day5.date?.getDate()).toBe(5);
        expect(day5.hasEntry).toBe(true);

        const day30 = days[padding + 29];
        expect(day30.date?.getDate()).toBe(30);
        expect(day30.hasEntry).toBe(true);

        const day6 = days[padding + 5];
        expect(day6.hasEntry).toBe(false);
    });

    it('renders 29 days for a leap February and 28 otherwise', () => {
        expect(buildCalendarDays(new Set(), 2024, 1)).toHaveLength(
            new Date(2024, 1, 1).getDay() + 29
        );
        expect(buildCalendarDays(new Set(), 2026, 1)).toHaveLength(
            new Date(2026, 1, 1).getDay() + 28
        );
    });
});
