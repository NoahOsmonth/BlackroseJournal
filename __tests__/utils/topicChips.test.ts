import type { HistoryItem, HistorySection } from '../../hooks/history/historyUtils';
import {
    TOPIC_CHIP_LIMIT,
    collectTopicChips,
    countTopicItems,
    filterSectionsByTopic,
    normalizeTopic,
    topicMatchesItem,
    topicWordsForItem,
} from '../../utils/topicChips';

function item(id: string, text: string, extra: Partial<HistoryItem> = {}): HistoryItem {
    return {
        id,
        type: 'journal',
        title: id,
        summary: text,
        createdAt: 1,
        sourceId: id,
        searchableText: text,
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
        monthKey: '2026-11',
        monthLabel: 'November 2026',
        items,
    };
}

describe('topicWordsForItem', () => {
    it('is a SET: ten mentions in one entry count once', () => {
        const words = topicWordsForItem(item('a', 'garden garden garden garden garden'));
        expect(words.has('garden')).toBe(true);
        expect(words.size).toBe(1);
    });

    it('drops grammar, tiny words and punctuation but keeps real topics', () => {
        const words = topicWordsForItem(item('a', 'Today I really felt: garden, WORK, coffee!'));
        expect(words.has('garden')).toBe(true);
        expect(words.has('work')).toBe(true);
        expect(words.has('coffee')).toBe(true);
        expect(words.has('today')).toBe(false);
        expect(words.has('really')).toBe(false);
        expect(words.has('felt')).toBe(false);
        expect(words.has('i')).toBe(false);
    });

    it('drops grammar comparators like than, found by live QA', () => {
        // Live Archive QA showed 'than · 4' as a browsable topic chip.
        const words = topicWordsForItem(item('a', 'more than better than rather than'));
        expect(words.has('than')).toBe(false);
        expect(words.has('better')).toBe(true);
        expect(words.has('rather')).toBe(true);
    });

    it('keeps non-Latin words intact', () => {
        const words = topicWordsForItem(item('a', '工作压力 garden'));
        expect(words.has('工作压力')).toBe(true);
        expect(words.has('garden')).toBe(true);
    });

    it('falls back to title/summary/mood when no search corpus is present', () => {
        const words = topicWordsForItem(item('a', '', { searchableText: undefined, title: 'A quiet morning', mood: 'calm' }));
        expect(words.has('quiet')).toBe(true);
        expect(words.has('morning')).toBe(true);
        expect(words.has('calm')).toBe(true);
    });
});

describe('collectTopicChips', () => {
    it('ranks by DISTINCT entries, not raw mentions', () => {
        const sections = [section('d1', [
            item('a', 'garden garden garden garden garden garden garden garden'),
            item('b', 'garden coffee'),
            item('c', 'coffee coffee'),
        ])];
        const chips = collectTopicChips(sections, 10);
        // garden had 9 mentions; coffee had 3. Both appear in 2 DISTINCT
        // entries, so counts tie and the alphabetical tie-break wins.
        expect(chips.map((c) => c.label)).toEqual(['coffee', 'garden']);
        expect(chips.find((c) => c.label === 'garden')).toEqual({ label: 'garden', count: 2 });
        expect(chips.find((c) => c.label === 'coffee')).toEqual({ label: 'coffee', count: 2 });
    });

    it('breaks ties alphabetically so the row never jitters', () => {
        const chips = collectTopicChips([section('d1', [item('a', 'zebra apple mango')])], 3);
        expect(chips.map((c) => c.label)).toEqual(['apple', 'mango', 'zebra']);
    });

    it('counts across sections and respects the limit', () => {
        const sections = [
            section('d1', [item('a', 'garden'), item('b', 'garden')]),
            section('d2', [item('c', 'garden coffee')]),
        ];
        const chips = collectTopicChips(sections, TOPIC_CHIP_LIMIT);
        expect(chips[0]).toEqual({ label: 'garden', count: 3 });
        expect(collectTopicChips(sections, 1)).toHaveLength(1);
    });

    it('returns [] for an empty feed and never throws on a bad limit', () => {
        expect(collectTopicChips([], 8)).toEqual([]);
        expect(collectTopicChips([section('d1', [item('a', 'garden')])], 0)).toEqual([]);
        expect(collectTopicChips([section('d1', [item('a', 'garden')])], -1)).toEqual([]);
    });

    it('is deterministic across repeated calls', () => {
        const sections = [section('d1', [item('a', 'garden coffee work garden')])];
        expect(collectTopicChips(sections)).toEqual(collectTopicChips(sections));
    });
});

describe('filterSectionsByTopic', () => {
    const sections = [
        section('d1', [item('a', 'garden coffee'), item('b', 'work')]),
        section('d2', [item('c', 'GARDEN, work!'), item('d', 'coffee')]),
        section('d3', [item('e', 'nothing here')]),
    ];

    it('keeps only matching items and drops empty day headings', () => {
        const filtered = filterSectionsByTopic(sections, 'garden');
        expect(filtered.map((s) => s.dateKey)).toEqual(['d1', 'd2']);
        expect(filtered[0].items.map((i) => i.id)).toEqual(['a']);
        expect(filtered[1].items.map((i) => i.id)).toEqual(['c']);
    });

    it('is case and punctuation insensitive and does not mutate the input', () => {
        expect(filterSectionsByTopic(sections, '  Work! ')[0].items.map((i) => i.id)).toEqual(['b']);
        expect(sections[0].items).toHaveLength(2);
        expect(sections).toHaveLength(3);
    });

    it('returns a full shallow copy for a blank topic', () => {
        const all = filterSectionsByTopic(sections, '   ');
        expect(all).toHaveLength(3);
        expect(all[0]).not.toBe(sections[0]);
        expect(all[0].items).toEqual(sections[0].items);
    });

    it('returns no sections for an unknown topic', () => {
        expect(filterSectionsByTopic(sections, 'spaceship')).toEqual([]);
        expect(topicMatchesItem(item('a', 'garden'), 'spaceship')).toBe(false);
    });
});

describe('honest counts after other filters', () => {
    it('recounts against a narrowed feed, not the original', () => {
        const full = [section('d1', [item('a', 'garden'), item('b', 'garden'), item('c', 'coffee')])];
        expect(countTopicItems(full, 'garden')).toBe(2);
        const narrowed = filterSectionsByTopic(full, 'coffee');
        expect(countTopicItems(narrowed, 'garden')).toBe(0);
    });

    it('normalizeTopic strips punctuation and case', () => {
        expect(normalizeTopic('  Garden! ')).toBe('garden');
        expect(normalizeTopic('')).toBe('');
    });
});
