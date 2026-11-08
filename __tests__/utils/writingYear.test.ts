/**
 * A year of writing - pure grid builder. Fixed end dates, no clock.
 */
import {
    buildWritingYearGrid,
    wordsByDayFromDayKeys,
    writingLevel,
    WRITING_YEAR_WEEKS,
    DAYS_PER_WEEK,
} from '../../utils/writingYear';
import { getLocalDateKey } from '../../utils/date';

/** Local noon avoids any timezone rollover in the test runner. */
const end = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0);

describe('writingLevel', () => {
    it('maps words to five gentle tone steps', () => {
        expect([0, -5, 1, 49, 50, 149, 150, 349, 350, 900].map(writingLevel))
            .toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
    });
});

describe('buildWritingYearGrid', () => {
    it('always produces 53 columns of 7 Sunday-first days', () => {
        const grid = buildWritingYearGrid(new Map(), end(2026, 11, 9));
        expect(grid.weeksCount).toBe(WRITING_YEAR_WEEKS);
        expect(grid.weeks).toHaveLength(53);
        grid.weeks.forEach((week) => {
            expect(week).toHaveLength(DAYS_PER_WEEK);
            expect(new Date(week[0].dateKey + 'T12:00:00').getDay()).toBe(0);
        });
    });

    it('ends on the requested local day and marks exactly one today', () => {
        const grid = buildWritingYearGrid(new Map(), end(2026, 11, 9));
        expect(grid.endDateKey).toBe('2026-11-09');
        const todays = grid.weeks.flat().filter((d) => d.isToday);
        expect(todays).toHaveLength(1);
        expect(todays[0].dateKey).toBe('2026-11-09');
    });

    it('pads days after today instead of counting them', () => {
        const grid = buildWritingYearGrid(new Map(), end(2026, 11, 9));
        const after = grid.weeks.flat().filter((d) => d.dateKey > '2026-11-09');
        expect(after.length).toBeGreaterThan(0);
        expect(after.every((d) => d.isPadding && d.level === 0 && d.words === 0)).toBe(true);
    });

    it('counts words only from real, in-window keys', () => {
        const grid = buildWritingYearGrid(
            new Map([['2026-11-08', 200], ['2026-11-09', 40], ['2099-01-01', 9999]]),
            end(2026, 11, 9),
        );
        expect(grid.totalDaysWritten).toBe(2);
        expect(grid.totalWords).toBe(240);
        const cells = grid.weeks.flat();
        expect(cells.find((d) => d.dateKey === '2026-11-08')?.level).toBe(3);
        expect(cells.find((d) => d.dateKey === '2026-11-09')?.level).toBe(1);
    });

    it('handles a leap day without shifting weekday alignment', () => {
        const grid = buildWritingYearGrid(new Map([['2024-02-29', 100]]), end(2024, 3, 1));
        const leap = grid.weeks.flat().find((d) => d.dateKey === '2024-02-29');
        expect(leap).toBeDefined();
        expect(leap?.level).toBe(2);
        expect(new Date('2024-02-29T12:00:00').getDay()).toBe(4);
        expect(leap?.isPadding).toBe(false);
    });

    it('labels each month once and in ascending week order', () => {
        const grid = buildWritingYearGrid(new Map(), end(2026, 11, 9));
        expect(grid.monthLabels.length).toBeGreaterThanOrEqual(12);
        expect(grid.monthLabels.length).toBeLessThanOrEqual(13);
        const indices = grid.monthLabels.map((m) => m.weekIndex);
        expect(indices).toEqual([...indices].sort((a, b) => a - b));
        expect(new Set(grid.monthLabels.map((m) => m.label)).size).toBeGreaterThanOrEqual(12);
    });

    it('is deterministic for the same input', () => {
        const input = new Map([['2026-11-01', 500]]);
        const a = buildWritingYearGrid(input, end(2026, 11, 9));
        const b = buildWritingYearGrid(input, end(2026, 11, 9));
        expect(a).toEqual(b);
    });

    it('start date is 371 days before the last column Sunday', () => {
        const grid = buildWritingYearGrid(new Map(), end(2026, 11, 9));
        const last = grid.weeks[52][6].dateKey;
        const start = grid.startDateKey;
        const days = Math.round((new Date(last + 'T12:00:00').getTime() - new Date(start + 'T12:00:00').getTime()) / 86400000);
        expect(days).toBe(370);
    });
});

describe('wordsByDayFromDayKeys', () => {
    it('drops malformed keys', () => {
        const map = wordsByDayFromDayKeys(new Set(['2026-11-09', 'garbage', '2026-02-30']));
        expect([...map.keys()]).toEqual(['2026-11-09']);
    });

    it('uses a uniform weight so a day-set grid has one tone', () => {
        const map = wordsByDayFromDayKeys(new Set(['2026-11-08', '2026-11-09']), 100);
        const grid = buildWritingYearGrid(map, end(2026, 11, 9));
        expect(grid.totalDaysWritten).toBe(2);
        expect(grid.totalWords).toBe(200);
    });

    it('matches getLocalDateKey for a real timestamp', () => {
        const key = getLocalDateKey(new Date(2026, 10, 9, 23, 30));
        expect(key).toBe('2026-11-09');
        expect(wordsByDayFromDayKeys(new Set([key])).has(key)).toBe(true);
    });
});
