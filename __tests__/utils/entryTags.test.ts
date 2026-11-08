import fs from 'fs';
import path from 'path';

import type { HistoryItem, HistorySection } from '../../hooks/history/historyUtils';
import {
    collectTagChips,
    countTagItems,
    filterSectionsByTag,
    formatTagLabel,
    normalizeTag,
    resolveActiveTag,
} from '../../utils/entryTags';

function item(id: string, type: HistoryItem['type'] = 'journal'): HistoryItem {
    return {
        id: `${type}-${id}`, type, title: 'A day', summary: 'Some words',
        createdAt: 1000, sourceId: id,
    };
}

function section(dateKey: string, items: HistoryItem[]): HistorySection {
    return {
        dateKey, label: dateKey, dayNumber: 1, weekdayShort: 'Mon',
        relativeLabel: null, monthKey: '2026-11', monthLabel: 'November',
        items,
    };
}

const sections = [
    section('2026-11-09', [item('a'), item('b'), item('c', 'checkin')]),
    section('2026-11-08', [item('d')]),
];

// A check-in can never carry a writer-chosen label, even if a stale map has one.
const tags = { a: ['work', 'family'], b: ['work'], c: ['work'], d: ['trip'] };

describe('writer-chosen label helpers (pure)', () => {
    it('normalizes one canonical key for a label', () => {
        expect(normalizeTag('  Work  ')).toBe('work');
        expect(normalizeTag('FAMILY')).toBe('family');
        expect(normalizeTag('  ')).toBe('');
        expect(formatTagLabel('  WORK ')).toBe('Work');
    });

    it('filters by the raw entry id, never the display id', () => {
        const rows = filterSectionsByTag(sections, 'work', tags);
        expect(rows).toHaveLength(1);
        expect(rows[0].items.map((i) => i.sourceId)).toEqual(['a', 'b']);
        // A check-in with that label must NOT match: only journal entries carry them.
        expect(rows[0].items.some((i) => i.type === 'checkin')).toBe(false);
    });

    it('an empty label shows every section rather than an empty archive', () => {
        expect(filterSectionsByTag(sections, '   ', tags)).toHaveLength(2);
        // An empty label means no filter, so the whole feed is behind "All".
        expect(countTagItems(sections, '', tags)).toBe(4);
    });

    it('counts DISTINCT entries, not mentions', () => {
        expect(countTagItems(sections, 'work', tags)).toBe(2);
        expect(countTagItems(sections, 'trip', tags)).toBe(1);
        expect(countTagItems(sections, 'nope', tags)).toBe(0);
    });

    it('ranks chips by count then alphabetically and caps the row', () => {
        const chips = collectTagChips(sections, tags);
        expect(chips[0]).toEqual({ label: 'work', count: 2 });
        expect(chips.map((c) => c.label)).toContain('family');
        expect(chips.map((c) => c.label)).toContain('trip');
        const many = collectTagChips(
            [section('x', Array.from({ length: 12 }, (_, i) => item('e' + i)))],
            Object.fromEntries(Array.from({ length: 12 }, (_, i) => ['e' + i, ['tag' + i]])),
        );
        expect(many.length).toBeLessThanOrEqual(8);
    });

    it('drops a stale selection instead of trapping the writer', () => {
        const chips = collectTagChips(sections, tags);
        expect(resolveActiveTag(chips, 'work')).toBe('work');
        expect(resolveActiveTag(chips, 'gone')).toBe('');
        expect(resolveActiveTag([], 'work')).toBe('');
    });

    it('stays pure: no I/O, no hooks, no clock', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '..', '..', 'utils', 'entryTags.ts'), 'utf8');
        expect(source).not.toContain('AsyncStorage');
        expect(source).not.toContain('useState');
        expect(source).not.toContain('Date.now()');
    });
});
