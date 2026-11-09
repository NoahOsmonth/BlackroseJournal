/**
 * Stepping a day (Kaneo #111).
 */
import { clampDayKey, shiftDayKey } from '../../utils/dayStep';

describe('shiftDayKey', () => {
    it('steps forward and back inside a month', () => {
        expect(shiftDayKey('2026-11-09', 1)).toBe('2026-11-10');
        expect(shiftDayKey('2026-11-09', -1)).toBe('2026-11-08');
    });

    it('crosses a month end without inventing a day', () => {
        expect(shiftDayKey('2026-11-30', 1)).toBe('2026-12-01');
        expect(shiftDayKey('2026-12-01', -1)).toBe('2026-11-30');
    });

    it('crosses a year end', () => {
        expect(shiftDayKey('2026-12-31', 1)).toBe('2027-01-01');
        expect(shiftDayKey('2026-01-01', -1)).toBe('2025-12-31');
    });

    it('handles a leap day', () => {
        expect(shiftDayKey('2028-02-28', 1)).toBe('2028-02-29');
        expect(shiftDayKey('2028-02-29', 1)).toBe('2028-03-01');
    });

    it('returns the input unchanged when it is not a date key', () => {
        expect(shiftDayKey('not-a-date', 1)).toBe('not-a-date');
        expect(shiftDayKey('', 1)).toBe('');
    });
});

describe('clampDayKey', () => {
    it('keeps a day inside the drawn range', () => {
        expect(clampDayKey('2025-01-01', '2025-11-10', '2026-11-09')).toBe('2025-11-10');
        expect(clampDayKey('2030-01-01', '2025-11-10', '2026-11-09')).toBe('2026-11-09');
        expect(clampDayKey('2026-05-05', '2025-11-10', '2026-11-09')).toBe('2026-05-05');
    });
});
