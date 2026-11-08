import type { HistoryItem, HistorySection } from '../../hooks/history/historyUtils';
import {
    MOOD_CHIP_LIMIT,
    collectMoodChips,
    countMoodItems,
    filterSectionsByMood,
    moodMatchesItem,
    moodWordForItem,
    normalizeMood,
} from '../../utils/moodChips';

function item(id: string, mood?: string): HistoryItem {
    return {
        id,
        type: 'journal',
        title: id,
        summary: 'words',
        mood,
        createdAt: 1,
        sourceId: id,
    };
}

function section(dateKey: string, items: HistoryItem[]): HistorySection {
    return {
        dateKey,
        label: dateKey,
        dayNumber: 1,
        weekdayShort: 'Mon',
        relativeLabel: null,
        monthKey: '2026-11',
        monthLabel: 'November 2026',
        items,
    };
}

describe('normalizeMood / moodWordForItem', () => {
    it('strips emoji via the app existing plainMoodWord', () => {
        expect(moodWordForItem(item('a', 'Calm 😌'))).toBe('Calm');
        expect(normalizeMood('Calm 😌')).toBe('calm');
    });

    it('is case and whitespace insensitive', () => {
        expect(normalizeMood('  CALM  ')).toBe('calm');
        expect(moodMatchesItem(item('a', 'calm'), 'Calm')).toBe(true);
        expect(moodMatchesItem(item('a', 'Calm'), ' calm ')).toBe(true);
    });

    it('returns null/empty for missing or picture-only moods', () => {
        expect(moodWordForItem(item('a'))).toBeNull();
        expect(moodWordForItem(item('a', '😌'))).toBeNull();
        expect(normalizeMood('')).toBe('');
    });
});

describe('collectMoodChips', () => {
    it('merges emoji, case and spacing variants into ONE chip', () => {
        const chips = collectMoodChips([section('d1', [
            item('a', 'Calm 😌'), item('b', 'calm'), item('c', 'Calm'),
        ])]);
        expect(chips).toEqual([{ label: 'Calm', count: 3 }]);
    });

    it('counts DISTINCT entries and breaks ties alphabetically', () => {
        const chips = collectMoodChips([section('d1', [
            item('a', 'Warm'), item('b', 'Warm'), item('c', 'Tense'), item('d', 'Tense'),
        ])]);
        expect(chips).toEqual([
            { label: 'Tense', count: 2 },
            { label: 'Warm', count: 2 },
        ]);
    });

    it('ignores items with no mood and never invents a chip', () => {
        expect(collectMoodChips([section('d1', [item('a'), item('b', '😌')])])).toEqual([]);
    });

    it('counts across sections and respects the limit', () => {
        const sections = [
            section('d1', [item('a', 'Calm'), item('b', 'Calm')]),
            section('d2', [item('c', 'Calm'), item('d', 'Proud')]),
        ];
        expect(collectMoodChips(sections)[0]).toEqual({ label: 'Calm', count: 3 });
        expect(collectMoodChips(sections, 1)).toHaveLength(1);
        expect(collectMoodChips(sections, 0)).toEqual([]);
        expect(collectMoodChips(sections, -1)).toEqual([]);
        expect(MOOD_CHIP_LIMIT).toBe(6);
    });

    it('is deterministic and does not mutate the input', () => {
        const sections = [section('d1', [item('a', 'Warm'), item('b', 'Calm 😌')])];
        expect(collectMoodChips(sections)).toEqual(collectMoodChips(sections));
        expect(sections[0].items).toHaveLength(2);
    });
});

describe('filterSectionsByMood', () => {
    const sections = [
        section('d1', [item('a', 'Calm'), item('b', 'Tense'), item('c', 'Calm 😌')]),
        section('d2', [item('d', 'warm'), item('e')]),
        section('d3', [item('f', 'Proud')]),
    ];

    it('keeps only matching items and drops empty day headings', () => {
        const filtered = filterSectionsByMood(sections, 'calm');
        expect(filtered.map((s) => s.dateKey)).toEqual(['d1']);
        expect(filtered[0].items.map((i) => i.id)).toEqual(['a', 'c']);
    });

    it('does not mutate the input', () => {
        filterSectionsByMood(sections, 'Warm');
        expect(sections[0].items).toHaveLength(3);
        expect(sections).toHaveLength(3);
    });

    it('returns a full shallow copy for a blank mood', () => {
        const all = filterSectionsByMood(sections, '   ');
        expect(all).toHaveLength(3);
        expect(all[0]).not.toBe(sections[0]);
        expect(all[0].items).toEqual(sections[0].items);
    });

    it('returns no sections for an unknown mood', () => {
        expect(filterSectionsByMood(sections, 'giddy')).toEqual([]);
        expect(moodMatchesItem(item('a', 'Calm'), 'giddy')).toBe(false);
    });
});

describe('honest counts after other filters', () => {
    it('recounts against a narrowed feed, not the original', () => {
        const full = [section('d1', [item('a', 'Calm'), item('b', 'Calm'), item('c', 'Tense')])];
        expect(countMoodItems(full, 'Calm')).toBe(2);
        const narrowed = filterSectionsByMood(full, 'Tense');
        expect(countMoodItems(narrowed, 'Calm')).toBe(0);
    });
});
