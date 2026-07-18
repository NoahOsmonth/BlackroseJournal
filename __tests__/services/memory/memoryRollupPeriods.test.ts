import {
    formatIsoWeekKey,
    isPeriodClosed,
    windowForIsoWeekKey,
    windowForMonthKey,
    windowForYearKey,
} from '../../../services/memory/memoryRollupPeriods';

describe('memoryRollupPeriods', () => {
    it('formats ISO week keys and windows (Mon–Sun)', () => {
        // 2026-07-15 is a Wednesday
        const d = new Date(2026, 6, 15);
        const key = formatIsoWeekKey(d);
        expect(key).toMatch(/^2026-W\d{2}$/);
        const win = windowForIsoWeekKey(key);
        expect(win).not.toBeNull();
        expect(win!.dateFrom <= '2026-07-15').toBe(true);
        expect(win!.dateTo >= '2026-07-15').toBe(true);
        // Monday → Sunday span is 6 days
        expect(win!.kind).toBe('week');
    });

    it('builds month and year windows', () => {
        expect(windowForMonthKey('2026-07')).toEqual({
            kind: 'month',
            periodKey: '2026-07',
            dateFrom: '2026-07-01',
            dateTo: '2026-07-31',
        });
        expect(windowForYearKey('2026')?.dateFrom).toBe('2026-01-01');
        expect(windowForYearKey('2026')?.dateTo).toBe('2026-12-31');
    });

    it('detects closed periods relative to now', () => {
        const now = new Date(2026, 6, 17);
        expect(isPeriodClosed('2026-07-12', now)).toBe(true);
        expect(isPeriodClosed('2026-07-17', now)).toBe(false);
        expect(isPeriodClosed('2026-07-20', now)).toBe(false);
    });
});
