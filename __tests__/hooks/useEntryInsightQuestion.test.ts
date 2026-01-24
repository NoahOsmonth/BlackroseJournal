import { act, renderHook } from '@testing-library/react-native';
import { useEntryInsightQuestion } from '../../hooks/insights/useEntryInsightQuestion';
import { JournalEntry } from '../../services/journal/journalStorage.types';

const PROMPTS = [
    'What activities could help you recharge and regain energy?',
    'What small win from today deserves more credit?',
    'Where did you feel most grounded this week?',
    'What would make tomorrow feel 10% lighter?',
    'Which moment deserves a gentle reframe?',
];

function buildEntry(content: string): JournalEntry {
    const now = Date.now();
    return {
        id: 'entry-1',
        title: 'Test Entry',
        emoji: ':)',
        status: 'completed',
        createdAt: now,
        updatedAt: now,
        messages: [
            {
                id: 'msg-1',
                role: 'user',
                content,
                timestamp: now,
            },
        ],
    };
}

describe('useEntryInsightQuestion', () => {
    it('returns the first prompt for empty entries', () => {
        const { result } = renderHook(() => useEntryInsightQuestion([]));

        expect(result.current.question).toBe(PROMPTS[0]);
    });

    it('cycles to the next prompt on refresh', () => {
        const { result } = renderHook(() => useEntryInsightQuestion([]));
        const first = result.current.question;

        act(() => {
            result.current.refresh();
        });

        expect(result.current.question).not.toBe(first);
        expect(PROMPTS).toContain(result.current.question);
    });

    it('resets question when entries change', () => {
        const { result, rerender } = renderHook(
            ({ entries }) => useEntryInsightQuestion(entries),
            { initialProps: { entries: [] as JournalEntry[] } }
        );

        act(() => {
            result.current.refresh();
        });

        rerender({ entries: [buildEntry('Hello there')] });

        const expectedIndex = (1 + 2) % PROMPTS.length;
        expect(result.current.question).toBe(PROMPTS[expectedIndex]);
    });
});
