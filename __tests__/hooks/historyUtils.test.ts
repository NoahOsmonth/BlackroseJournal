import {
    buildHistoryItems,
    buildWeeklyHistorySummary,
    createHistorySectionSearch,
    filterHistoryItems,
    filterHistorySections,
    filterHistorySectionsByQuery,
    formatWeekProse,
    groupHistorySections,
    resolveDayMeta,
    type HistoryItem,
    type HistorySection,
} from '../../hooks/history/historyUtils';
import type { JournalEntry } from '../../services/journal/journalStorage.types';
import type { IntentionCheckIn } from '../../services/intentions/intentionsStorage.types';

function makeEntry(
    id: string,
    createdAt: number,
    title: string,
    analysisMood?: string,
    overrides: Partial<JournalEntry> = {}
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
        ...overrides,
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

describe('buildHistoryItems provenance', () => {
    it("carries 'threads' through so Archive can label it", () => {
        const items = buildHistoryItems(
            [makeEntry('e1', Date.UTC(2026, 8, 19), 'Calm mornings', undefined, {
                origin: 'threads',
            })],
            []
        );
        expect(items[0]?.origin).toBe('threads');
    });

    it('leaves origin undefined for a chat entry', () => {
        const items = buildHistoryItems(
            [makeEntry('e1', Date.UTC(2026, 8, 19), 'Calm mornings')],
            []
        );
        expect(items[0]?.origin).toBeUndefined();
    });
});

describe('Archive full-corpus search', () => {
    const at = new Date(2026, 5, 1, 9).getTime();

    function sectionsOf(items: HistoryItem[]): HistorySection[] {
        return [{ dateKey: '2026-06-01', label: 'Monday June 1', dayNumber: 1,
            weekdayShort: 'Mon', relativeLabel: null, monthKey: '2026-06',
            monthLabel: 'June', items }];
    }

    function transcriptEntry(): JournalEntry {
        return { ...makeEntry('j1', at, 'Career focus'),
            messages: [
                { id: 'm1', role: 'user', content: 'I felt career stress today.', timestamp: at },
                { id: 'm2', role: 'assistant', content: 'Let us follow the lantern thread.', timestamp: at },
                { id: 'm3', role: 'user', content: 'Later I found a quicksilver lantern.', timestamp: at },
                { id: 'm4', role: 'assistant', content: 'A nocturnal accordion played softly.', timestamp: at },
            ],
            analysis: { insight: 'A marigold insight about rest.', quote: 'Make room for quiet.',
                mood: 'Reflective', topics: ['marigold', 'rest'], generatedAt: at } };
    }

    function messageCheckIn(): IntentionCheckIn {
        return { ...makeCheckIn('c1', at), messages: [
            { id: 'cm1', role: 'user', content: 'A velvet thunderstorm rolled in.', timestamp: at },
            { id: 'cm2', role: 'assistant', content: 'Tell me more about the sky.', timestamp: at },
        ] };
    }

    function ids(sections: HistorySection[]): string[] {
        return sections.flatMap((section) => section.items.map((item) => item.id));
    }
    const journalSections = () => sectionsOf(buildHistoryItems([transcriptEntry()], []));
    const checkInSections = () => sectionsOf(buildHistoryItems([], [messageCheckIn()]));

    it('keeps the visible summary as the writer’s first words only', () => {
        const journal = buildHistoryItems([transcriptEntry()], [])[0];
        expect(journal.summary).toBe('I felt career stress today.');
        expect(journal.summary).not.toContain('nocturnal accordion');
        expect(journal.searchableText).toContain('nocturnal accordion');
    });

    it('finds a later user turn, not just the first message', () => {
        expect(ids(filterHistorySectionsByQuery(journalSections(), 'quicksilver lantern')))
            .toEqual(['journal-j1']);
    });

    it('finds an assistant reply', () => {
        expect(ids(filterHistorySectionsByQuery(journalSections(), 'nocturnal accordion')))
            .toEqual(['journal-j1']);
    });

    it('finds structured analysis text (insight, quote, topics)', () => {
        expect(ids(filterHistorySectionsByQuery(journalSections(), 'marigold'))).toEqual(['journal-j1']);
        expect(ids(filterHistorySectionsByQuery(journalSections(), 'make room for quiet')))
            .toEqual(['journal-j1']);
    });

    it('finds a check-in message body beyond its summary', () => {
        expect(ids(filterHistorySectionsByQuery(checkInSections(), 'velvet thunderstorm')))
            .toEqual(['checkin-c1']);
    });

    it('matches case-insensitively', () => {
        const sections = sectionsOf(buildHistoryItems([transcriptEntry()], [messageCheckIn()]));
        expect(ids(filterHistorySectionsByQuery(sections, 'QUICKSILVER Lantern')))
            .toEqual(['journal-j1']);
        expect(ids(filterHistorySectionsByQuery(sections, 'VELVET THUNDERSTORM')))
            .toEqual(['checkin-c1']);
    });

    it('returns every section for an empty or whitespace query', () => {
        const sections = journalSections();
        expect(filterHistorySectionsByQuery(sections, '')).toEqual(sections);
        expect(filterHistorySectionsByQuery(sections, '   \n  ')).toEqual(sections);
    });

    it('returns no sections when nothing matches', () => {
        expect(filterHistorySectionsByQuery(journalSections(), 'zephyr-nonexistent')).toEqual([]);
    });

    it('falls back to title/summary/mood for a legacy plain item', () => {
        const legacy: HistoryItem = { id: 'legacy-1', type: 'journal', title: 'Old ledger',
            summary: 'A faded note', mood: 'Calm', createdAt: at, sourceId: 'legacy' };
        const sections = sectionsOf([legacy]);
        expect(ids(filterHistorySectionsByQuery(sections, 'faded note'))).toEqual(['legacy-1']);
        expect(ids(filterHistorySectionsByQuery(sections, 'calm'))).toEqual(['legacy-1']);
        expect(filterHistorySectionsByQuery(sections, 'quicksilver')).toEqual([]);
    });

    it('tolerates undefined analysis/messages and non-string fields', () => {
        const bare = makeEntry('bare', at, 'Only a title', undefined,
            { messages: undefined, analysis: undefined }) as JournalEntry;
        const malformed = { ...makeEntry('malformed', at, 'Odd row'),
            messages: [
                { id: 'x', role: 'user', content: 'writer words', timestamp: at },
                { id: 'y', role: 'assistant', content: 12345, timestamp: at },
            ],
            analysis: { insight: 'still readable', quote: null, mood: 42,
                topics: ['topic one', 7], generatedAt: at },
        } as unknown as JournalEntry;
        const noMessages = { ...makeCheckIn('c2', at), messages: undefined } as IntentionCheckIn;
        const sections = sectionsOf(buildHistoryItems([bare, malformed], [noMessages]));
        expect(ids(filterHistorySectionsByQuery(sections, 'only a title'))).toEqual(['journal-bare']);
        expect(ids(filterHistorySectionsByQuery(sections, 'still readable')))
            .toEqual(['journal-malformed']);
        expect(ids(filterHistorySectionsByQuery(sections, 'evening career reset')))
            .toEqual(['checkin-c2']);
    });

    it('prepares one reusable corpus for repeated queries', () => {
        const sections = journalSections();
        const search = createHistorySectionSearch(sections);
        expect(ids(search('quicksilver'))).toEqual(['journal-j1']);
        expect(ids(search('marigold'))).toEqual(['journal-j1']);
        expect(search('  ')).toEqual(sections);
    });
});
