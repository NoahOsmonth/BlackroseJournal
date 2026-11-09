import { buildMoodStrip, MOOD_STRIP_DAYS, recordedCells } from '../../utils/dayMoodStrip';

const TODAY = '2026-11-09';

function day(moodId: string | null) {
    return { moodId, factorIds: [], updatedAt: 0 };
}

describe('buildMoodStrip', () => {
    it('runs oldest to newest, ending on today', () => {
        const cells = buildMoodStrip({}, TODAY);
        expect(cells).toHaveLength(MOOD_STRIP_DAYS);
        expect(cells[0].dateKey).toBe('2026-10-11');
        expect(cells[cells.length - 1].dateKey).toBe(TODAY);
        expect(cells[0].position).toBe(1);
        expect(cells[cells.length - 1].position).toBe(MOOD_STRIP_DAYS);
    });

    it('keeps a day with nothing recorded as a gap, not a missing slot', () => {
        const cells = buildMoodStrip({ '2026-11-09': day('heavy') }, TODAY);
        expect(cells).toHaveLength(MOOD_STRIP_DAYS);
        expect(recordedCells(cells)).toBe(1);
        const empty = cells.filter((cell) => cell.moodId === null);
        expect(empty).toHaveLength(MOOD_STRIP_DAYS - 1);
        expect(empty[0].step).toBeNull();
        expect(empty[0].label).toBe('Oct 11: no entry');
    });

    it('walks the ramp from light to restless', () => {
        const cells = buildMoodStrip(
            {
                '2026-11-05': day('light'),
                '2026-11-06': day('calm'),
                '2026-11-07': day('mixed'),
                '2026-11-08': day('heavy'),
                '2026-11-09': day('restless'),
            },
            TODAY,
        );
        const steps = cells.slice(-5).map((cell) => cell.step);
        expect(steps).toEqual([1, 2, 3, 4, 5]);
        expect(cells[cells.length - 1].label).toBe('Nov 9: Restless');
    });

    it('ignores days outside the strip and days it does not know', () => {
        const cells = buildMoodStrip(
            { '2026-10-10': day('light'), '2026-11-09': day('not-a-mood') },
            TODAY,
        );
        expect(recordedCells(cells)).toBe(0);
        expect(cells[cells.length - 1].label).toBe('Nov 9: no entry');
    });

    it('crosses a month boundary without skipping a day', () => {
        const cells = buildMoodStrip({}, '2026-03-02', 4);
        expect(cells.map((cell) => cell.dateKey)).toEqual([
            '2026-02-27',
            '2026-02-28',
            '2026-03-01',
            '2026-03-02',
        ]);
    });
});
