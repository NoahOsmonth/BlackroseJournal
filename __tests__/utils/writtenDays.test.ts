import {
    buildFeedRows,
    buildWrittenDayChips,
    filterSectionsByDay,
    formatWrittenDay,
    resolveActiveDay,
} from '@/utils/writtenDays';
import type { HistorySection } from '@/hooks/history/historyUtils';

function section(dateKey: string, overrides: Partial<HistorySection> = {}): HistorySection {
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12);
    return {
        dateKey,
        label: `${date.toLocaleDateString('en-US', { weekday: 'long' })} ${date.toLocaleDateString('en-US', { month: 'long' })} ${day}`,
        dayNumber: day,
        weekdayShort: date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3),
        relativeLabel: null,
        monthKey: `${year}-${String(month).padStart(2, '0')}`,
        monthLabel: date.toLocaleDateString('en-US', { month: 'long' }),
        items: [],
        ...overrides,
    };
}

const twoItems = (n: number) => Array.from({ length: n }, (_, i) => ({
    id: `i${i}`,
    type: 'journal' as const,
    title: 't',
    summary: 's',
    createdAt: 0,
    sourceId: `s${i}`,
}));

describe('writtenDays', () => {
    it('builds one chip per day, newest first, with the real item count', () => {
        const chips = buildWrittenDayChips([
            section('2026-03-03', { items: twoItems(2) }),
            section('2026-11-09', { items: twoItems(1) }),
            section('2026-03-03', { items: twoItems(3) }),
            section('2025-12-31', { items: twoItems(1) }),
        ]);
        expect(chips.map((c) => c.dateKey)).toEqual(['2026-11-09', '2026-03-03', '2025-12-31']);
        expect(chips.find((c) => c.dateKey === '2026-03-03')?.itemCount).toBe(5);
    });

    it('uses short month labels and keeps Today / Yesterday plain', () => {
        const chips = buildWrittenDayChips([
            section('2026-03-03'),
            section('2026-11-09', { relativeLabel: 'today' }),
            section('2026-11-08', { relativeLabel: 'yesterday' }),
        ]);
        expect(chips[0].shortLabel).toBe('Today');
        expect(chips[1].shortLabel).toBe('Yesterday');
        expect(chips[2].shortLabel).toBe('Mar 3');
    });

    it('skips corrupt date keys rather than offering a dead chip', () => {
        const chips = buildWrittenDayChips([
            section('not-a-date'),
            section('2026-13-45'),
            section('2026-03-03'),
        ]);
        expect(chips.map((c) => c.dateKey)).toEqual(['2026-03-03']);
    });

    it('tolerates a section with a missing items array', () => {
        const broken = section('2026-03-03');
        // A corrupt row must not throw or invent a count.
        expect(buildWrittenDayChips([{ ...broken, items: undefined } as unknown as HistorySection])[0].itemCount).toBe(0);
    });

    it('filterSectionsByDay keeps only the chosen day', () => {
        const sections = [section('2026-11-09'), section('2026-03-03')];
        expect(filterSectionsByDay(sections, '2026-03-03').map((s) => s.dateKey)).toEqual(['2026-03-03']);
        expect(filterSectionsByDay(sections, '  ')).toBe(sections);
        expect(filterSectionsByDay(sections, '2026-01-01')).toEqual([]);
    });

    it('drops a stale selection that the narrowed feed no longer offers', () => {
        const chips = buildWrittenDayChips([section('2026-11-09')]);
        expect(resolveActiveDay(chips, '2026-11-09')).toBe('2026-11-09');
        expect(resolveActiveDay(chips, '2026-03-03')).toBe('');
        expect(resolveActiveDay(chips, '')).toBe('');
        expect(resolveActiveDay([], '2026-11-09')).toBe('');
    });

    it('formats a plain-language empty-state day', () => {
        expect(formatWrittenDay(section('2026-03-03'))).toBe('on Mar 3, 2026');
        expect(formatWrittenDay(section('2026-11-09', { relativeLabel: 'today' }))).toBe('today');
        expect(formatWrittenDay(section('2026-11-08', { relativeLabel: 'yesterday' }))).toBe('yesterday');
    });

    it('buildFeedRows inserts a month break only when the month changes', () => {
        const rows = buildFeedRows([
            section('2026-11-09'),
            section('2026-11-08'),
            section('2026-10-31'),
        ]);
        expect(rows.map((r) => r.kind)).toEqual(['section', 'section', 'month', 'section']);
        expect(rows[2]).toMatchObject({ kind: 'month', label: 'October' });
        expect(rows[0]).toMatchObject({ kind: 'section', key: '2026-11-09' });
    });

    it('buildFeedRows on one day needs no month break', () => {
        expect(buildFeedRows([section('2026-11-09')])).toHaveLength(1);
        expect(buildFeedRows([])).toEqual([]);
    });

    it('is deterministic', () => {
        const input = [section('2026-03-03'), section('2026-11-09')];
        expect(buildWrittenDayChips(input)).toEqual(buildWrittenDayChips(input));
        expect(buildFeedRows(input)).toEqual(buildFeedRows(input));
    });
});
