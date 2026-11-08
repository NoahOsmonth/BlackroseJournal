/**
 * Day grouping for the writing-year tap-to-read path. Fixed timestamps via
 * local Date construction: no clock, no I/O, portable across OS time zones.
 */
import { formatWritingDay, groupWritingByDay, type DayWritingItem } from '../../utils/writingDay';
import { getLocalDateKey } from '../../utils/date';

const ts = (y: number, m: number, d: number, hour = 12) => new Date(y, m - 1, d, hour).getTime();
const item = (id: string, t: number, words: number): DayWritingItem<string> => ({
    id, createdAt: t, words, title: 'Title ' + id, value: id,
});

describe('groupWritingByDay', () => {
    it('groups by LOCAL calendar day, not a UTC-shifted day', () => {
        // 23:30 at night must stay on the same local day the writer saw.
        const late = ts(2026, 11, 9, 23);
        const grouped = groupWritingByDay([item('a', late, 20)]);
        expect([...grouped.keys()]).toEqual([getLocalDateKey(new Date(late))]);
        expect(getLocalDateKey(new Date(late))).toBe('2026-11-09');
    });

    it('sums words across several entries on one day', () => {
        const grouped = groupWritingByDay([
            item('a', ts(2026, 11, 9, 9), 10),
            item('b', ts(2026, 11, 9, 21), 40),
        ]);
        expect(grouped.get('2026-11-09')?.totalWords).toBe(50);
        expect(grouped.get('2026-11-09')?.items).toHaveLength(2);
    });

    it('orders items newest-first within a day', () => {
        const grouped = groupWritingByDay([
            item('old', ts(2026, 11, 9, 9), 10),
            item('new', ts(2026, 11, 9, 21), 10),
        ]);
        expect(grouped.get('2026-11-09')?.items.map((i) => i.id)).toEqual(['new', 'old']);
    });

    it('keeps separate days separate', () => {
        const grouped = groupWritingByDay([
            item('a', ts(2026, 11, 9), 10),
            item('b', ts(2026, 11, 10), 20),
        ]);
        expect(grouped.size).toBe(2);
        expect(grouped.get('2026-11-10')?.totalWords).toBe(20);
    });

    it('clamps negative word counts instead of shrinking the day', () => {
        const grouped = groupWritingByDay([item('a', ts(2026, 11, 9), -5)]);
        expect(grouped.get('2026-11-09')?.totalWords).toBe(0);
    });

    it('handles an empty list', () => {
        expect(groupWritingByDay<string>([]).size).toBe(0);
    });
});

describe('formatWritingDay', () => {
    it('writes a plain, full date', () => {
        expect(formatWritingDay('2026-11-09')).toContain('November 9, 2026');
    });
    it('returns the key itself for a malformed value', () => {
        expect(formatWritingDay('nonsense')).toBe('nonsense');
    });
});
