/* eslint-disable import/first */

/**
 * `weeklyStats` is memoized on `getWeeklyItems`, whose identity only changes when
 * the journal/check-in arrays change. `getWeeklyItems` reads the clock, so a
 * screen left open across a week boundary would keep last week's counts while
 * the "This week · …" label advanced. The memo therefore also depends on the
 * current week's start.
 *
 * Fake timers are required: the hook calls `new Date()`, which `Date.now = …`
 * does not affect.
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
    },
}));

const mockCompletedEntries: unknown[] = [];
const mockCompletedCheckIns: unknown[] = [];

jest.mock('@/hooks/journal/useJournalEntries', () => ({
    useJournalEntries: () => ({
        completed: mockCompletedEntries,
        isLoading: false,
    }),
}));

jest.mock('@/hooks/intentions/useIntentionCheckIns', () => ({
    useIntentionCheckIns: () => ({
        completed: mockCompletedCheckIns,
        isLoading: false,
    }),
}));

jest.mock('@/services/ai/insights', () => ({
    generateWeeklyInsights: jest.fn().mockResolvedValue({
        emotionalLandscape: [],
        keyThemes: [],
        castOfCharacters: [],
        weeklySummary: 'Test summary.',
    }),
}));

jest.mock('@/services/insights/weeklyInsightsStorage', () => ({
    getCurrentWeekKey: jest.fn(() => '2026-W24'),
    loadCachedInsights: jest.fn().mockResolvedValue(null),
    saveCachedInsights: jest.fn().mockResolvedValue(undefined),
    computeWeeklyContentHash: jest.fn(() => 'hash'),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useWeeklyInsights } from '@/hooks/insights/useWeeklyInsights';
import type { JournalEntry } from '@/services/journal/journalStorage.types';

function buildEntry(createdAt: number, contents: string[]): JournalEntry {
    return {
        id: `entry-${createdAt}`,
        title: 'Entry',
        emoji: '🌹',
        status: 'completed',
        createdAt,
        updatedAt: createdAt,
        messages: contents.map((content, index) => ({
            id: `msg-${createdAt}-${index}`,
            role: 'user',
            content,
            timestamp: createdAt + index,
        })),
    };
}

/** Local noon on the Wednesday of the week containing `reference`. */
function wednesdayOf(reference: Date): Date {
    const wednesday = new Date(reference);
    wednesday.setDate(reference.getDate() - reference.getDay() + 3);
    wednesday.setHours(12, 0, 0, 0);
    return wednesday;
}

describe('useWeeklyInsights across a week boundary', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('recomputes the stats when the clock enters a new week', async () => {
        const thisWednesday = wednesdayOf(new Date('2026-11-04T12:00:00'));
        jest.useFakeTimers();
        jest.setSystemTime(thisWednesday);

        mockCompletedEntries.length = 0;
        mockCompletedEntries.push(buildEntry(thisWednesday.getTime(), ['one two three four five']));

        const { result, rerender } = renderHook(() => useWeeklyInsights());

        await waitFor(() => expect(result.current.weeklyStats.totalWords).toBe(5));
        expect(result.current.weeklyStats.entriesCount).toBe(1);

        // A full week later. The entry array is untouched, so `getWeeklyItems`
        // keeps its identity and only the clock has moved — the entry now falls
        // outside the current week, so the stats must drop to zero. `rerender`
        // supplies the render pass a real screen would get from any interaction.
        jest.setSystemTime(new Date('2026-11-11T12:00:00'));

        await act(async () => {
            rerender(undefined);
        });

        await waitFor(() => expect(result.current.weeklyStats.totalWords).toBe(0));
        expect(result.current.weeklyStats.entriesCount).toBe(0);
    });
});
