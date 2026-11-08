import {
    MIN_WEEKS_FOR_PATTERN,
    describeWeekCount,
    findRecurringThemes,
    hasEnoughRollupsForPatterns,
} from '@/utils/recurringThemes';
import type { MemoryRollup } from '@/services/memory/memoryRollup.types';

function week(periodKey: string, topics: string[]): MemoryRollup {
    return {
        schemaVersion: 1,
        kind: 'week',
        periodKey,
        dateFrom: '2026-01-01',
        dateTo: '2026-01-07',
        summary: '',
        topics,
        sourceCount: 3,
        createdAt: 0,
        updatedAt: 0,
    };
}

function month(periodKey: string, topics: string[]): MemoryRollup {
    return { ...week(periodKey, topics), kind: 'month' };
}

describe('findRecurringThemes', () => {
    it('finds a topic that appears in three weeks', () => {
        const themes = findRecurringThemes([
            week('2026-W40', ['work stress']),
            week('2026-W41', ['work stress']),
            week('2026-W42', ['work stress']),
        ]);
        expect(themes).toHaveLength(1);
        expect(themes[0].topic).toBe('work stress');
        expect(themes[0].weekCount).toBe(3);
        expect(themes[0].weeks).toEqual(['2026-W40', '2026-W41', '2026-W42']);
    });

    it('ignores a topic that appears in only two weeks', () => {
        expect(findRecurringThemes([
            week('2026-W40', ['sleep']),
            week('2026-W41', ['sleep']),
        ])).toEqual([]);
    });

    it('ignores month rollups so a topic is not double counted', () => {
        const themes = findRecurringThemes([
            week('2026-W40', ['sleep']),
            week('2026-W41', ['sleep']),
            month('2026-01', ['sleep']),
        ]);
        expect(themes).toEqual([]);
    });

    it('counts a topic once per week even if listed twice', () => {
        const themes = findRecurringThemes([
            week('2026-W40', ['sleep', 'sleep']),
            week('2026-W41', ['sleep']),
            week('2026-W42', ['sleep']),
        ]);
        expect(themes[0].weekCount).toBe(3);
    });

    it('treats different letter case and spacing as one topic', () => {
        const themes = findRecurringThemes([
            week('2026-W40', ['Work  Stress']),
            week('2026-W41', ['work stress']),
            week('2026-W42', ['WORK STRESS']),
        ]);
        expect(themes).toHaveLength(1);
        expect(themes[0].topic).toBe('work stress');
        expect(themes[0].weekCount).toBe(3);
    });

    it('skips blank topics', () => {
        const themes = findRecurringThemes([
            week('2026-W40', ['  ', '']),
            week('2026-W41', ['  ']),
            week('2026-W42', ['  ']),
        ]);
        expect(themes).toEqual([]);
    });

    it('puts the most frequent theme first', () => {
        // sleep in 4 weeks, work in 3 - so frequency, not recency, decides
        const themes = findRecurringThemes([
            week('2026-W40', ['sleep']),
            week('2026-W41', ['sleep', 'work']),
            week('2026-W42', ['sleep', 'work']),
            week('2026-W43', ['sleep', 'work']),
        ]);
        expect(themes.map((theme) => theme.topic)).toEqual(['sleep', 'work']);
    });

    it('breaks a tie by the most recent week', () => {
        const themes = findRecurringThemes([
            week('2026-W40', ['old theme']),
            week('2026-W41', ['old theme']),
            week('2026-W42', ['old theme']),
            week('2026-W30', ['new theme']),
            week('2026-W41', ['new theme']),
            week('2026-W45', ['new theme']),
        ]);
        expect(themes[0].topic).toBe('new theme');
    });

    it('records the most recent week a topic appeared in', () => {
        const themes = findRecurringThemes([
            week('2026-W40', ['sleep']),
            week('2026-W41', ['sleep']),
            week('2026-W47', ['sleep']),
        ]);
        expect(themes[0].lastWeek).toBe('2026-W47');
    });

    it('returns nothing for an empty list', () => {
        expect(findRecurringThemes([])).toEqual([]);
    });
});

describe('describeWeekCount', () => {
    it('says one week plainly', () => {
        expect(describeWeekCount(1)).toBe('1 week');
    });

    it('pluralises beyond one', () => {
        expect(describeWeekCount(4)).toBe('4 weeks');
    });
});

describe('hasEnoughRollupsForPatterns', () => {
    it('says no when there are too few weeks', () => {
        expect(hasEnoughRollupsForPatterns([week('2026-W40', []), week('2026-W41', [])])).toBe(false);
    });

    it('says yes at the threshold', () => {
        const weeks = Array.from({ length: MIN_WEEKS_FOR_PATTERN }, (_, i) => week(`2026-W4${i}`, []));
        expect(hasEnoughRollupsForPatterns(weeks)).toBe(true);
    });

    it('does not count month rollups toward the threshold', () => {
        expect(hasEnoughRollupsForPatterns([
            week('2026-W40', []),
            month('2026-01', []),
            month('2026-02', []),
        ])).toBe(false);
    });
});
