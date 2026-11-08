/**
 * filterStarredSections: only starred journal entries survive, empty day
 * headings disappear, and check-ins are never starred.
 */
import { filterStarredSections } from '../../utils/starredSections';
import type { HistoryItem, HistorySection } from '../../hooks/history/historyUtils';

function item(id: string, type: HistoryItem['type'] = 'journal'): HistoryItem {
    return {
        // Real HistoryFeed builds a display id with a prefix; the star store
        // holds the raw entry id (sourceId). Keep that distinction here so the
        // filter cannot pass by comparing against the wrong field.
        id: `journal-${id}`,
        type,
        title: 'A moment',
        summary: 'Some words',
        createdAt: 1_700_000_000_000,
        sourceId: id,
    };
}

function section(dateKey: string, items: HistoryItem[]): HistorySection {
    return { dateKey, items } as HistorySection;
}

describe('filterStarredSections', () => {
    const day1 = section('2026-11-08', [item('a'), item('b'), item('checkin-1', 'checkin')]);
    const day2 = section('2026-11-09', [item('c')]);

    it('returns no sections when nothing is starred', () => {
        expect(filterStarredSections([day1, day2], new Set())).toEqual([]);
    });

    it('keeps only the starred items and drops empty days', () => {
        const result = filterStarredSections([day1, day2], new Set(['a']));
        expect(result).toHaveLength(1);
        expect(result[0].dateKey).toBe('2026-11-08');
        expect(result[0].items.map((i) => i.id)).toEqual(['journal-a']);
        expect(result[0].items[0].sourceId).toBe('a');
    });

    it('matches the raw entry id, never the prefixed display id (regression)', () => {
        // Live QA round 34: the filter said "1 shown" but rendered an empty
        // list because it compared the star store's raw id to HistoryItem.id.
        expect(filterStarredSections([day1], new Set(['journal-a']))).toEqual([]);
        expect(filterStarredSections([day1], new Set(['a']))).toHaveLength(1);
    });

    it('never includes a check-in even if its id is in the set', () => {
        const result = filterStarredSections([day1], new Set(['checkin-1']));
        expect(result).toEqual([]);
    });

    it('handles several starred ids across different days', () => {
        const result = filterStarredSections([day1, day2], new Set(['a', 'c']));
        expect(result).toHaveLength(2);
        expect(result.map((s) => s.items.length)).toEqual([1, 1]);
    });

    it('does not mutate the input sections', () => {
        const input = [day1, day2];
        filterStarredSections(input, new Set(['a']));
        expect(day1.items).toHaveLength(3);
        expect(input).toHaveLength(2);
    });

    it('ignores an id that is not present', () => {
        expect(filterStarredSections([day1], new Set(['missing']))).toEqual([]);
    });
});
