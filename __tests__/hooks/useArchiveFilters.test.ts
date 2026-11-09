import { renderHook } from '@testing-library/react-native';

import { useArchiveFilters } from '@/hooks/journal/useArchiveFilters';
import type { HistoryItem, HistorySection } from '@/hooks/history/historyUtils';

function item(id: string, title: string, extra: Partial<HistoryItem> = {}): HistoryItem {
    return {
        id,
        type: 'journal',
        title,
        summary: '',
        createdAt: 0,
        sourceId: id,
        ...extra,
    };
}

function section(dateKey: string, items: HistoryItem[]): HistorySection {
    return {
        dateKey,
        label: dateKey,
        dayNumber: 1,
        weekdayShort: 'Mon',
        relativeLabel: null,
        monthKey: dateKey.slice(0, 7),
        monthLabel: 'January',
        items,
    };
}

const SECTIONS: HistorySection[] = [
    section('2026-11-02', [item('a', 'A long walk'), item('b', 'Work standup')]),
    section('2026-11-01', [item('c', 'Quiet morning')]),
];

const TAGS = { a: ['walk'], b: ['work'], c: ['quiet'] };

function run(overrides: Record<string, unknown> = {}) {
    return renderHook(() => useArchiveFilters({
        searchSections: (query: string) => (query.trim().length === 0
            ? SECTIONS
            : SECTIONS
                .map((s) => ({ ...s, items: s.items.filter((i) => i.title.toLowerCase().includes(query.toLowerCase())) }))
                .filter((s) => s.items.length > 0)),
        starredSet: new Set<string>(),
        tagsByEntry: TAGS,
        query: '',
        showStarredOnly: false,
        activeTopic: '',
        activeTag: '',
        activeMood: '',
        activeDay: '',
        ...overrides,
    }));
}

describe('useArchiveFilters', () => {
    it('shows the whole feed when nothing is chosen', () => {
        const { result } = run();
        expect(result.current.visibleSections).toHaveLength(2);
        expect(result.current.resolvedTag).toBe('');
        expect(result.current.resolvedDay).toBe('');
    });

    it('narrows the feed by the search query before anything else', () => {
        const { result } = run({ query: 'walk' });
        expect(result.current.visibleSections).toHaveLength(1);
        expect(result.current.visibleSections[0].items[0].sourceId).toBe('a');
    });

    it('builds label chips from the starred feed, not the whole feed', () => {
        const { result } = run({ showStarredOnly: true, starredSet: new Set(['b']) });
        expect(result.current.tagChips.map((chip) => chip.label)).toEqual(['work']);
    });

    it('offers only days that still have writing after the label filter', () => {
        const { result } = run({ activeTag: 'work' });
        expect(result.current.resolvedTag).toBe('work');
        expect(result.current.writtenDayChips.map((chip) => chip.dateKey)).toEqual(['2026-11-02']);
        expect(result.current.visibleSections).toHaveLength(1);
    });

    it('drops a stale label instead of showing an empty feed', () => {
        const { result } = run({ activeTag: 'gone' });
        expect(result.current.resolvedTag).toBe('');
        expect(result.current.visibleSections).toHaveLength(2);
    });

    it('applies the day choice last, on top of the label choice', () => {
        const { result } = run({ activeTag: 'work', activeDay: '2026-11-01' });
        // The day is not offered after the label narrows the feed, so it is dropped.
        expect(result.current.resolvedDay).toBe('');
        expect(result.current.visibleSections).toHaveLength(1);
    });
});
