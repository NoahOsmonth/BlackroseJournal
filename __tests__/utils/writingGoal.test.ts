/**
 * A gentle writing goal — pure builder. Fixed dates, no clock read, portable.
 */
import {
    buildWritingGoalProgress,
    DEFAULT_WRITING_GOAL,
    normalizeWritingGoalSettings,
    WRITING_GOAL_WINDOW_DAYS,
    type WritingGoalSettings,
} from '../../utils/writingGoal';

const today = new Date(2026, 10, 9, 12);
const ts = (year: number, month: number, day: number) => new Date(year, month - 1, day, 12).getTime();
const rec = (offsetDays: number, words: number) => ({
    createdAt: new Date(2026, 10, 9 - offsetDays, 12).getTime(),
    words,
});
const goal: WritingGoalSettings = { wordsPerDay: 100, restDaysPerWeek: 2 };

describe('normalizeWritingGoalSettings', () => {
    it('keeps supported presets', () => {
        expect(normalizeWritingGoalSettings({ wordsPerDay: 250, restDaysPerWeek: 3 })).toEqual({ wordsPerDay: 250, restDaysPerWeek: 3 });
    });

    it('falls back for corrupt or missing values', () => {
        expect(normalizeWritingGoalSettings(null)).toEqual(DEFAULT_WRITING_GOAL);
        expect(normalizeWritingGoalSettings({ wordsPerDay: -4, restDaysPerWeek: 99 })).toEqual(DEFAULT_WRITING_GOAL);
        expect(normalizeWritingGoalSettings({ wordsPerDay: Number.NaN, restDaysPerWeek: 1 }).restDaysPerWeek).toBe(1);
    });
});

describe('buildWritingGoalProgress days', () => {
    it('builds a 28-day window ending today', () => {
        const p = buildWritingGoalProgress([], goal, today);
        expect(p.days).toHaveLength(WRITING_GOAL_WINDOW_DAYS);
        expect(p.days[0].dateKey).toBe('2026-10-13');
        expect(p.days[27].dateKey).toBe('2026-11-09');
        expect(p.days[27].isToday).toBe(true);
        expect(p.days.filter((d) => d.isToday)).toHaveLength(1);
    });

    it('marks today pending when nothing is written yet', () => {
        const p = buildWritingGoalProgress([], goal, today);
        expect(p.days[27].state).toBe('pending');
        expect(p.days[27].streakSafe).toBe(true);
        expect(p.metToday).toBe(false);
    });

    it('counts a met day and reaches the target today', () => {
        const p = buildWritingGoalProgress([rec(0, 140)], goal, today);
        expect(p.days[27].state).toBe('met');
        expect(p.days[27].words).toBe(140);
        expect(p.metToday).toBe(true);
        expect(p.wordsThisWeek).toBe(140);
    });

    it('calls a short writing day light, not met and not missed', () => {
        const p = buildWritingGoalProgress([rec(1, 40)], goal, today);
        expect(p.days[26].state).toBe('light');
        expect(p.days[26].streakSafe).toBe(true);
    });

    it('clamps negative and fractional word counts', () => {
        const p = buildWritingGoalProgress([{ createdAt: ts(2026, 11, 9), words: -50 }, { createdAt: ts(2026, 11, 9), words: 10.9 }], goal, today);
        expect(p.totalWords).toBe(10);
    });
});

describe('buildWritingGoalProgress rest days', () => {
    it('forgives blank days up to the weekly allowance', () => {
        // 11-08 met, 11-07 rest, 11-06 met, 11-05 rest, 11-04 missed.
        const p = buildWritingGoalProgress([rec(1, 120), rec(3, 120)], goal, today);
        expect(p.days.slice(22, 28).map((d) => d.state)).toEqual(['missed', 'rest', 'met', 'rest', 'met', 'pending']);
        expect(p.currentStreak).toBe(4);
    });

    it('cannot stack rest days forever: a fully blank week breaks the streak', () => {
        const p = buildWritingGoalProgress([rec(8, 120)], goal, today);
        const last7 = p.days.slice(-7);
        expect(last7.filter((d) => d.state === 'rest').length).toBeLessThanOrEqual(2);
        expect(last7.some((d) => d.state === 'missed')).toBe(true);
        expect(p.currentStreak).toBe(0);
    });

    it('rest allowance is 7-day rolling, not per calendar week', () => {
        // Written days do not consume rests; seven blank days still cannot all
        // be forgiven even though they straddle two calendar weeks.
        const p = buildWritingGoalProgress([], { wordsPerDay: 100, restDaysPerWeek: 2 }, today);
        const blank = p.days.slice(0, 27);
        expect(blank.filter((d) => d.state === 'rest').length).toBeLessThanOrEqual(8);
        expect(blank.filter((d) => d.state === 'missed').length).toBeGreaterThan(15);
    });

    it('zero rest days makes every blank day a miss', () => {
        const p = buildWritingGoalProgress([], { wordsPerDay: 100, restDaysPerWeek: 0 }, today);
        expect(p.days.slice(0, 27).every((d) => d.state === 'missed')).toBe(true);
        expect(p.restDaysLeftThisWeek).toBe(0);
    });

    it('reports rest days left this week', () => {
        const p = buildWritingGoalProgress([rec(1, 120), rec(2, 120), rec(3, 120)], goal, today);
        expect(p.restDaysUsed).toBeLessThanOrEqual(2);
        expect(p.restDaysLeftThisWeek).toBe(2 - p.restDaysUsed);
    });
});

describe('buildWritingGoalProgress streak and totals', () => {
    it('counts the longest safe run in the window', () => {
        const records = [0, 1, 2, 3, 4, 5, 6].map((d) => rec(d, 120));
        const p = buildWritingGoalProgress(records, goal, today);
        expect(p.longestStreak).toBeGreaterThanOrEqual(6);
        expect(p.daysMet).toBe(7);
    });

    it('ignores records outside the window', () => {
        const p = buildWritingGoalProgress([{ createdAt: ts(2025, 1, 1), words: 9999 }, rec(0, 100)], goal, today);
        expect(p.totalWords).toBe(100);
        expect(p.days).toHaveLength(28);
        expect(p.days[0].words).toBe(0);
    });

    it('returns a calm empty journal', () => {
        const p = buildWritingGoalProgress([], goal, today);
        expect(p.totalWords).toBe(0);
        expect(p.daysMet).toBe(0);
        expect(p.metToday).toBe(false);
    });

    it('is deterministic for the same input', () => {
        const input = [rec(1, 130), rec(4, 80)];
        expect(buildWritingGoalProgress(input, goal, today)).toEqual(buildWritingGoalProgress(input, goal, today));
    });
});
