import { getCurrentWeekKey } from '../../../services/insights/weeklyInsightsStorage';

/**
 * Week-key contract for the weekly-insights cache:
 *  - never emits an invalid week number (W00/W54+)
 *  - resolves to a single stable key for every day in the same Sunday-based week
 *  - anchors the label year to the week's Thursday so the year-boundary week
 *    (e.g. Dec 27 2026 → Jan 2 2027) does not split across two keys
 */
describe('getCurrentWeekKey', () => {
    it('never produces an invalid W00 week number at year boundaries', () => {
        for (const date of [
            new Date(2024, 0, 1),
            new Date(2025, 0, 1),
            new Date(2026, 0, 1),
            new Date(2027, 0, 1),
        ]) {
            expect(getCurrentWeekKey(date)).not.toMatch(/W(00|5[4-9]|[6-9]\d)/);
        }
        expect(getCurrentWeekKey(new Date(2026, 11, 31))).toMatch(/^202\d-W\d{2}$/);
    });

    it('maps the year-boundary week to a single stable key from every day in it', () => {
        // The week Mon? — No: Sunday Dec 27 2026→Sat Jan 2 2027 rolls into 2026-W53.
        const keys = [];
        for (let i = 0; i < 7; i += 1) {
            keys.push(getCurrentWeekKey(new Date(2026, 11, 27 + i)));
        }
        expect(new Set(keys).size).toBe(1);
        expect(keys[0]).toBe('2026-W53');
    });

    it('advances the label year only once the boundary week closes', () => {
        expect(getCurrentWeekKey(new Date(2027, 0, 2))).toBe('2026-W53');
        expect(getCurrentWeekKey(new Date(2027, 0, 3))).toBe('2027-W02');
    });

    it('is consistent for every day within an arbitrary mid-year week', () => {
        // Week of Sunday Feb 8 2026 → Sat Feb 14 2026.
        const base = getCurrentWeekKey(new Date(2026, 1, 8));
        for (let i = 0; i < 7; i += 1) {
            expect(getCurrentWeekKey(new Date(2026, 1, 8 + i))).toBe(base);
        }
        expect(base).toMatch(/^202\d-W\d{2}$/);
    });

    it('is consistent for every day within the year-boundary week (Sun Dec 31 2023→Sat Jan 6 2024)', () => {
        const base = getCurrentWeekKey(new Date(2023, 11, 31));
        for (let i = 0; i < 7; i += 1) {
            expect(getCurrentWeekKey(new Date(2023, 11, 31 + i))).toBe(base);
        }
    });
});