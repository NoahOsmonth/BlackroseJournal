import {
    buildHistoryItems,
    buildWeeklyHistorySummary,
} from '../../hooks/history/historyUtils';
import type { JournalEntry } from '../../services/journal/journalStorage.types';
import type { IntentionCheckIn } from '../../services/intentions/intentionsStorage.types';

function makeEntry(id: string, createdAt: number, title: string): JournalEntry {
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
        expect(summary.topSignals).toContain('career');
    });
});
