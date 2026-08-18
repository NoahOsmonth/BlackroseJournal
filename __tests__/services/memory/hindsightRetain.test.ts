import { buildRetainItemsFromJournalEntry, buildRetainItemsFromCheckIn } from '../../../services/memory/hindsight/hindsightRetain';
import type { JournalEntry } from '../../../services/journal/journalStorage.types';
import type { IntentionCheckIn } from '../../../services/intentions/intentionsStorage.types';
import type { Message } from '../../../services/ai/chatTypes';

function msg(role: 'user' | 'assistant', content: string, ts = 1000): Message {
    return { id: `${role}-${ts}`, role, content, timestamp: ts, authoredTimezone: null, localDate: null, temporalProvenance: 'captured' };
}

function journalEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
    return {
        id: 'entry_1', title: 'Scarf from Grandma', emoji: '🧣',
        messages: [
            msg('user', 'I got a lilac scarf from Grandma today. She knitted it herself.'),
            msg('assistant', 'That is such a thoughtful gift.'),
        ],
        status: 'completed',
        analysis: { insight: 'Gifts from family ground the user', mood: 'warm', topics: ['family'], quote: '', generatedAt: 1000 },
        createdAt: 1700000000000, updatedAt: 1700000000000,
        ...overrides,
    };
}

describe('hindsightRetain builders', () => {
    it('builds one item from a completed journal entry with user lines + analysis', () => {
        const items = buildRetainItemsFromJournalEntry(journalEntry());
        expect(items).toHaveLength(1);
        expect(items[0].document_id).toBe('journal_entry:entry_1');
        expect(items[0].timestamp).toBe(1700000000000);
        expect(items[0].content).toContain('lilac scarf from Grandma');
        expect(items[0].content).toContain('Insight: Gifts from family');
    });

    it('returns empty for draft entries', () => {
        expect(buildRetainItemsFromJournalEntry(journalEntry({ status: 'draft' }))).toEqual([]);
    });

    it('returns empty when there are no user lines', () => {
        expect(buildRetainItemsFromJournalEntry(journalEntry({ messages: [msg('assistant', 'hello')] }))).toEqual([]);
    });

    it('caps content length and drops assistant lines', () => {
        const long = 'x'.repeat(3000);
        const entry = journalEntry({ messages: [msg('user', `long ${long}`), msg('assistant', 'drop me')] });
        const items = buildRetainItemsFromJournalEntry(entry);
        expect(items[0].content.length).toBeLessThanOrEqual(2000);
        expect(items[0].content).not.toContain('drop me');
    });

    it('builds a check-in item with summary + user lines', () => {
        const checkIn: IntentionCheckIn = {
            id: 'ci_1', intentionId: 'int_1', type: 'morning', title: 'Morning check-in',
            summary: 'Sleepy but hopeful', mood: 'ok', messages: [msg('user', 'Woke up at 6, journaled, walked the dog')],
            status: 'completed', createdAt: 1700000000000, updatedAt: 1700000000000,
        };
        const items = buildRetainItemsFromCheckIn(checkIn);
        expect(items).toHaveLength(1);
        expect(items[0].document_id).toBe('intention_checkin:ci_1');
        expect(items[0].content).toContain('Woke up at 6');
    });

    it('returns empty for draft check-ins', () => {
        const checkIn: IntentionCheckIn = {
            id: 'ci_2', type: 'morning', title: 'draft', summary: '',
            status: 'draft', createdAt: 1, updatedAt: 1,
        };
        expect(buildRetainItemsFromCheckIn(checkIn)).toEqual([]);
    });
});
