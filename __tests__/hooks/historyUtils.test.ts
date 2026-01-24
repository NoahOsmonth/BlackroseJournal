import { buildHistoryItems, groupHistorySections, toDateKey } from '../../hooks/history/historyUtils';
import { JournalEntry } from '../../services/journal/journalStorage.types';
import { IntentionCheckIn } from '../../services/intentions/intentionsStorage.types';

function buildEntry(createdAt: number): JournalEntry {
    return {
        id: `entry-${createdAt}`,
        title: 'Test Entry',
        emoji: '🙂',
        status: 'completed',
        createdAt,
        updatedAt: createdAt,
        messages: [
            {
                id: `msg-${createdAt}`,
                role: 'user',
                content: 'First message content',
                timestamp: createdAt,
            },
        ],
    };
}

function buildCheckIn(createdAt: number): IntentionCheckIn {
    return {
        id: `checkin-${createdAt}`,
        type: 'intention',
        title: 'Check-in Title',
        summary: 'Check-in summary',
        mood: 'Reflective',
        status: 'completed',
        createdAt,
        updatedAt: createdAt,
    };
}

describe('historyUtils', () => {
    beforeAll(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date(2025, 0, 19, 12, 0, 0));
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    it('builds and sorts history items by createdAt', () => {
        const entry = buildEntry(1000);
        const checkIn = buildCheckIn(2000);

        const items = buildHistoryItems([entry], [checkIn]);

        expect(items).toHaveLength(2);
        expect(items[0].id).toBe(`checkin-${checkIn.id}`);
        expect(items[0].type).toBe('checkin');
        expect(items[1].type).toBe('journal');
        expect(items[1].summary).toContain('First message content');
    });

    it('groups items into date sections with local date keys', () => {
        const today = new Date(2025, 0, 19, 9, 30, 0);
        const yesterday = new Date(2025, 0, 18, 18, 0, 0);

        const items = [
            {
                id: 'one',
                type: 'journal' as const,
                title: 'Today Entry',
                summary: 'Summary',
                createdAt: today.getTime(),
                sourceId: 'entry-1',
            },
            {
                id: 'two',
                type: 'journal' as const,
                title: 'Yesterday Entry',
                summary: 'Summary',
                createdAt: yesterday.getTime(),
                sourceId: 'entry-2',
            },
        ];

        const sections = groupHistorySections(items);

        expect(sections).toHaveLength(2);
        expect(sections[0].dateKey).toBe(toDateKey(today.getTime()));
        expect(sections[0].label).toBe('Today January 19');
        expect(sections[1].label).toBe('Saturday January 18');
    });
});
