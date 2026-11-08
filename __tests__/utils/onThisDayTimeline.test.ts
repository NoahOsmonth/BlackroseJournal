import { getLocalDateKeyFromTimestamp } from '../../utils/date';
import type { OnThisDayEntry } from '../../utils/onThisDay';
import {
    buildOnThisDayTimeline,
    formatOnThisDayDate,
    stepOnThisDayDate,
    yearsAgoLabel,
} from '../../utils/onThisDayTimeline';

const NOW = new Date(2026, 10, 9, 9, 30);

function entry(
    id: string,
    year: number,
    month: number,
    day: number,
    overrides: Partial<OnThisDayEntry> = {},
): OnThisDayEntry {
    const createdAt = new Date(year, month, day, 8, 0).getTime();
    return {
        id,
        dateKey: getLocalDateKeyFromTimestamp(createdAt),
        createdAt,
        title: `Entry ${id}`,
        summary: `Words from ${id}` ,
        ...overrides,
    };
}

describe('buildOnThisDayTimeline', () => {
    it('keeps EVERY past year, not just one oldest memory', () => {
        const timeline = buildOnThisDayTimeline([
            entry('a', 2023, 10, 9),
            entry('b', 2024, 10, 9),
            entry('c', 2025, 10, 9),
        ], NOW);
        expect(timeline.years.map((g) => g.year)).toEqual([2025, 2024, 2023]);
        expect(timeline.totalMemories).toBe(3);
        expect(timeline.years.map((g) => g.label)).toEqual(['A year ago', 'Two years ago', 'Three years ago']);
    });

    it('keeps multiple entries in the same year, newest first', () => {
        const early = entry('early', 2024, 10, 9);
        const late = entry('late', 2024, 10, 9, { createdAt: new Date(2024, 10, 9, 20).getTime() });
        const timeline = buildOnThisDayTimeline([early, late], NOW);
        expect(timeline.years).toHaveLength(1);
        expect(timeline.years[0].entries.map((e) => e.id)).toEqual(['late', 'early']);
        expect(timeline.totalMemories).toBe(2);
    });

    it('ignores this year, later years, other days and malformed keys', () => {
        const timeline = buildOnThisDayTimeline([
            entry('this', 2026, 10, 9),
            entry('future', 2030, 10, 9),
            entry('other', 2024, 10, 10),
            entry('bad', 2024, 10, 9, { dateKey: 'not-a-date' }),
        ], NOW);
        expect(timeline.totalMemories).toBe(0);
        expect(timeline.years).toEqual([]);
    });

    it('returns an empty timeline for an empty journal', () => {
        const timeline = buildOnThisDayTimeline([], NOW);
        expect(timeline.totalMemories).toBe(0);
        expect(timeline.dateKey).toBe('2026-11-09');
        expect(timeline.dateLabel).toBe('November 9');
    });

    it('handles leap day without inventing matches in non-leap years', () => {
        const leapDay = new Date(2024, 1, 29, 10, 0);
        const timeline = buildOnThisDayTimeline([
            entry('leap', 2024, 1, 29),
            entry('feb28', 2023, 1, 28),
            entry('mar1', 2023, 2, 1),
        ], new Date(2026, 1, 28, 10, 0));
        // Feb 28 in 2026: only same month/day entries from earlier years match.
        expect(timeline.dateKey).toBe('2026-02-28');
        expect(timeline.totalMemories).toBe(1);
        const leapTimeline = buildOnThisDayTimeline([entry('leap', 2024, 1, 29)], leapDay);
        expect(leapTimeline.totalMemories).toBe(0);
        // Stepping from Feb 28 reaches Feb 29 on a leap year without crashing.
        expect(stepOnThisDayDate('2024-02-28', 1)).toBe('2024-02-29');
    });

    it('is deterministic and does not mutate the input', () => {
        const entries = [entry('a', 2024, 10, 9), entry('b', 2025, 10, 9)];
        const copy = [...entries];
        expect(buildOnThisDayTimeline(entries, NOW)).toEqual(buildOnThisDayTimeline(entries, NOW));
        expect(entries).toEqual(copy);
    });

    it('accepts a numeric timestamp as the day', () => {
        const timeline = buildOnThisDayTimeline([entry('a', 2024, 10, 9)], NOW.getTime());
        expect(timeline.years[0].year).toBe(2024);
    });
});

describe('date stepping and labels', () => {
    it('steps backwards and forwards across a month boundary', () => {
        expect(stepOnThisDayDate('2026-11-01', -1)).toBe('2026-10-31');
        expect(stepOnThisDayDate('2026-12-31', 1)).toBe('2027-01-01');
    });

    it('handles a year boundary and a malformed key', () => {
        expect(stepOnThisDayDate('2026-01-01', -1)).toBe('2025-12-31');
        expect(stepOnThisDayDate('bad', 1)).toBe('bad');
    });

    it('uses plain year labels for small and large spans', () => {
        expect(yearsAgoLabel(1)).toBe('A year ago');
        expect(yearsAgoLabel(5)).toBe('Five years ago');
        expect(yearsAgoLabel(9)).toBe('9 years ago');
    });

    it('formats the visited day without a year', () => {
        expect(formatOnThisDayDate('2026-11-09')).toBe('November 9');
        expect(formatOnThisDayDate('2024-02-29')).toBe('February 29');
    });
});
