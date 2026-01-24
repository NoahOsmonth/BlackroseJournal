import { buildCalendarDays, calculateStreakStats } from '../../utils/streakStats';

describe('streakStats utilities', () => {
    it('calculates current and longest streaks', () => {
        const stats = calculateStreakStats(
            ['2026-01-21', '2026-01-22', '2026-01-23'],
            new Date('2026-01-23T12:00:00Z')
        );

        expect(stats.currentStreak).toBe(3);
        expect(stats.longestStreak).toBe(3);
        expect(stats.totalDays).toBe(3);
    });

    it('handles gaps in streaks', () => {
        const stats = calculateStreakStats(
            ['2026-01-21', '2026-01-23'],
            new Date('2026-01-23T12:00:00Z')
        );

        expect(stats.currentStreak).toBe(1);
        expect(stats.longestStreak).toBe(1);
    });

    it('builds calendar days with completion flags', () => {
        const days = buildCalendarDays(new Set(['2026-01-03']), 2026, 0);
        const hasEntry = days.find((day) => day.date?.getDate() === 3);

        expect(hasEntry?.hasEntry).toBe(true);
        expect(days.length).toBeGreaterThan(28);
    });
});
