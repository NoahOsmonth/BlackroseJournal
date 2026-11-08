import {
    backfillCreatedAt,
    canWriteOnDay,
    formatWritingDay,
} from '../../utils/writingDay';
import { getLocalDateKey } from '../../utils/date';

const TODAY = '2026-11-09';
const NOW = new Date(2026, 10, 9, 18, 30, 0).getTime();

describe('writing on a past day', () => {
    describe('canWriteOnDay', () => {
        it('allows a real day in the past', () => {
            expect(canWriteOnDay('2026-11-07', TODAY)).toBe(true);
        });

        it('allows today, but leaves its clock to the storage layer', () => {
            expect(canWriteOnDay(TODAY, TODAY)).toBe(true);
            expect(backfillCreatedAt(TODAY, TODAY, NOW)).toBeUndefined();
        });

        it('refuses a future day', () => {
            expect(canWriteOnDay('2026-11-10', TODAY)).toBe(false);
            expect(backfillCreatedAt('2026-11-10', TODAY, NOW)).toBeUndefined();
        });

        it('refuses blank, corrupt and impossible keys', () => {
            for (const key of ['', 'nope', '2026-13-01', '2026-02-30', '2026-2-9', null]) {
                expect(canWriteOnDay(key as string, TODAY)).toBe(false);
                expect(backfillCreatedAt(key as string, TODAY, NOW)).toBeUndefined();
            }
            expect(canWriteOnDay('2026-11-07', 'bad-today')).toBe(false);
        });

        it('accepts a real leap day', () => {
            expect(canWriteOnDay('2024-02-29', TODAY)).toBe(true);
        });
    });

    describe('backfillCreatedAt', () => {
        it('lands at local midday on the chosen day', () => {
            const stamp = backfillCreatedAt('2026-11-07', TODAY, NOW)!;
            expect(stamp).toBe(new Date(2026, 10, 7, 12, 0, 0, 0).getTime());
            expect(getLocalDateKey(new Date(stamp))).toBe('2026-11-07');
        });

        it('crosses a year boundary without slipping a day', () => {
            const stamp = backfillCreatedAt('2025-12-31', TODAY, NOW)!;
            expect(getLocalDateKey(new Date(stamp))).toBe('2025-12-31');
        });

        it('never returns a time later than the real clock', () => {
            // A stale screen left open past midnight still offers yesterday.
            const justAfterMidnight = new Date(2026, 10, 9, 0, 1, 0).getTime();
            expect(backfillCreatedAt('2026-11-08', '2026-11-09', justAfterMidnight)).toBeDefined();
            // But a chosen day whose noon has not happened yet cannot be dated
            // into the future: refuse rather than invent a time.
            const earlyMorning = new Date(2026, 10, 9, 6, 0, 0).getTime();
            expect(backfillCreatedAt('2026-11-09', '2026-11-10', earlyMorning)).toBeUndefined();
        });

        it('is deterministic for the same inputs', () => {
            expect(backfillCreatedAt('2026-11-03', TODAY, NOW)).toBe(backfillCreatedAt('2026-11-03', TODAY, NOW));
        });
    });

    it('keeps the plain-language heading intact', () => {
        expect(formatWritingDay('2026-11-07')).toContain('2026');
    });
});
