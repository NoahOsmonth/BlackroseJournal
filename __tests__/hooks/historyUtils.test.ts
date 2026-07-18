import {
    buildHistoryItems,
    buildWeeklyHistorySummary,
    filterHistoryItems,
    filterHistorySections,
    formatWeekProse,
    groupHistorySections,
    resolveDayMeta,
} from '../../hooks/history/historyUtils';
import type { JournalEntry } from '../../services/journal/journalStorage.types';
import type { IntentionCheckIn } from '../../services/intentions/intentionsStorage.types';

function makeEntry(
    id: string,
    createdAt: number,
    title: string,
    analysisMood?: string
): JournalEntry {
    return {
        id,
        title,
        emoji: '📝',
        status: 'completed',
        createdAt,
        updatedAt: createdAt,
        messages: [{
            id: `${id}-message`,
            role: 'user',
            content: `${title} helped me understand career stress.`,
            timestamp: createdAt,
        }],
        analysis: analysisMood
            ? {
                insight: 'insight',
                quote: 'quote',
                mood: analysisMood,
                topics: ['career'],
                generatedAt: createdAt,
            }
            : undefined,
    };
}

function makeCheckIn(id: string, createdAt: number): IntentionCheckIn {
    return {
        id,
        type: 'evening',
        title: 'Evening career reset',
        summary: 'Career stress softened after a walk.',
        status: 'completed',
        createdAt,
        updatedAt: createdAt,
        mood: 'Calm',
    };
}

describe('historyUtils weekly summary', () => {
    it('summarizes this week across journal entries and check-ins', () => {
        const monday = new Date(2026, 5, 1, 9).getTime();
        const tuesday = new Date(2026, 5, 2, 20).getTime();
        const previousWeek = new Date(2026, 4, 27, 9).getTime();
        const now = new Date(2026, 5, 3, 12);
        const items = buildHistoryItems(
            [
                makeEntry('entry-1', monday, 'Career focus'),
                makeEntry('entry-2', previousWeek, 'Old rest note'),
            ],
            [makeCheckIn('checkin-1', tuesday)]
        );

        const summary = buildWeeklyHistorySummary(items, now);

        expect(summary.itemCount).toBe(2);
        expect(summary.journalCount).toBe(1);
        expect(summary.checkInCount).toBe(1);
        expect(summary.activeDays).toBe(2);
        expect(summary.activeDayKeys).toEqual(['2026-06-01', '2026-06-02']);
        expect(summary.weekDayKeys).toHaveLength(7);
        expect(summary.weekDayKeys[0]).toBe('2026-05-31');
        expect(summary.topSignals).toContain('career');
    });

    it('formats quiet prose for the week rhythm line', () => {
        const summary = buildWeeklyHistorySummary(
            buildHistoryItems(
                [makeEntry('e1', new Date(2026, 5, 1, 9).getTime(), 'One')],
                []
            ),
            new Date(2026, 5, 1, 12)
        );
        expect(formatWeekProse(summary)).toBe('1 entry · 1 day');
        expect(formatWeekProse({
            ...summary,
            itemCount: 0,
            activeDays: 0,
        })).toBeNull();
    });
});

describe('historyUtils build + filter', () => {
    it('maps journal analysis mood when present and never invents one', () => {
        const withMood = makeEntry('a', Date.now(), 'Grateful', '  Content  ');
        const withoutMood = makeEntry('b', Date.now(), 'Plain');
        const items = buildHistoryItems([withMood, withoutMood], []);
        expect(items.find((i) => i.sourceId === 'a')?.mood).toBe('Content');
        expect(items.find((i) => i.sourceId === 'b')?.mood).toBeUndefined();
    });

    it('filters journal vs ritual items', () => {
        const items = buildHistoryItems(
            [makeEntry('j1', Date.now(), 'Journal')],
            [makeCheckIn('c1', Date.now())]
        );
        expect(filterHistoryItems(items, 'journal')).toHaveLength(1);
        expect(filterHistoryItems(items, 'ritual')).toHaveLength(1);
        expect(filterHistoryItems(items, 'all')).toHaveLength(2);
    });

    it('groups sections with day meta and drops empty filter sections', () => {
        const now = new Date(2026, 5, 3, 12);
        const monday = new Date(2026, 5, 1, 9).getTime();
        const items = buildHistoryItems(
            [makeEntry('j1', monday, 'Journal')],
            [makeCheckIn('c1', monday)]
        );
        const sections = groupHistorySections(items, now);
        expect(sections[0].dayNumber).toBe(1);
        expect(sections[0].weekdayShort).toBe('Mon');
        expect(sections[0].monthLabel).toBe('June');

        const ritualsOnly = filterHistorySections(sections, 'ritual');
        expect(ritualsOnly).toHaveLength(1);
        expect(ritualsOnly[0].items.every((i) => i.type === 'checkin')).toBe(true);

        const journalsOnly = filterHistorySections(sections, 'journal');
        expect(journalsOnly[0].items.every((i) => i.type === 'journal')).toBe(true);
    });

    it('resolveDayMeta marks today and yesterday', () => {
        const now = new Date(2026, 5, 10, 15);
        const today = resolveDayMeta(new Date(2026, 5, 10), now);
        const yesterday = resolveDayMeta(new Date(2026, 5, 9), now);
        expect(today.relativeLabel).toBe('today');
        expect(today.label).toBe('Today');
        expect(yesterday.relativeLabel).toBe('yesterday');
        expect(yesterday.label).toBe('Yesterday');
    });
});
