/* eslint-disable import/first */

/**
 * Wiring guard for the re-scoped Archive search (Kaneo #26): the hook exposes a
 * memoized full-corpus search over the collections it already loaded once.
 * A search over a later turn, an assistant reply or a check-in message body
 * must match without any second storage read, and drafts must never appear.
 * The unit under test (useHistoryFeed) is NOT mocked — only its storage I/O.
 */

import type { JournalEntry } from '@/services/journal/journalStorage.types';
import type { IntentionCheckIn } from '@/services/intentions/intentionsStorage.types';

const at = new Date(2026, 5, 1, 9).getTime();

function msg(id: string, role: 'user' | 'assistant', content: string) {
    return { id, role, content, timestamp: at };
}

// Jest hoists mock factories above these consts, so all rows are inlined
// inside the factories (the unit under test, useHistoryFeed, is never mocked —
// only its storage I/O). The fixtures below reset each mocked read per test.
const completedEntry: JournalEntry = {
    id: 'j-full', title: 'Career focus', emoji: '🌹', status: 'completed',
    createdAt: at, updatedAt: at,
    messages: [
        msg('m1', 'user', 'I felt career stress today.'),
        msg('m2', 'assistant', 'Let us follow the lantern thread.'),
        msg('m3', 'user', 'Later I found a quicksilver lantern.'),
        msg('m4', 'assistant', 'A nocturnal accordion played softly.'),
    ],
    analysis: { insight: 'A marigold insight about rest.', quote: 'Make room for quiet.',
        mood: 'Reflective', topics: ['marigold'], generatedAt: at },
};
const draftEntry: JournalEntry = {
    id: 'j-draft', title: 'Unfinished', emoji: '🌹', status: 'draft',
    createdAt: at, updatedAt: at,
    messages: [msg('d1', 'user', 'A secret zephyr draft.')],
};
const completedCheckIn: IntentionCheckIn = {
    id: 'c-full', type: 'evening', title: 'Evening career reset',
    summary: 'A velvet thunderstorm', status: 'completed', createdAt: at, updatedAt: at,
    messages: [
        msg('c1', 'user', 'A velvet thunderstorm rolled in.'),
        msg('c2', 'assistant', 'Tell me more about the papaya sky.'),
    ],
};
const draftCheckIn: IntentionCheckIn = {
    id: 'c-draft', type: 'morning', title: 'Morning draft', summary: 'draft',
    status: 'draft', createdAt: at, updatedAt: at,
    messages: [msg('cd1', 'user', 'A secret zephyr check-in.')],
};

const journalRows: JournalEntry[] = [completedEntry, draftEntry];
const checkInRows: IntentionCheckIn[] = [completedCheckIn, draftCheckIn];

jest.mock('@/services/journal/journalStorage', () => ({
    createEntry: jest.fn(), deleteEntry: jest.fn(), getEntry: jest.fn(),
    listCompleted: jest.fn(), listDrafts: jest.fn(),
    listEntries: jest.fn(async () => [
        { id: 'j-full', title: 'Career focus', emoji: '🌹', status: 'completed',
          createdAt: 1, updatedAt: 1,
          messages: [
            { id: 'm1', role: 'user', content: 'I felt career stress today.', timestamp: 1 },
            { id: 'm2', role: 'assistant', content: 'Let us follow the lantern thread.', timestamp: 1 },
            { id: 'm3', role: 'user', content: 'Later I found a quicksilver lantern.', timestamp: 1 },
            { id: 'm4', role: 'assistant', content: 'A nocturnal accordion played softly.', timestamp: 1 },
          ],
          analysis: { insight: 'A marigold insight about rest.', quote: 'Make room for quiet.',
            mood: 'Reflective', topics: ['marigold'], generatedAt: 1 } },
        { id: 'j-draft', title: 'Unfinished', emoji: '🌹', status: 'draft',
          createdAt: 1, updatedAt: 1,
          messages: [{ id: 'd1', role: 'user', content: 'A secret zephyr draft.', timestamp: 1 }] },
    ]),
    updateEntry: jest.fn(),
}));

jest.mock('@/services/intentions/intentionsStorage', () => ({
    archiveIntention: jest.fn(), createCheckIn: jest.fn(), createIntention: jest.fn(),
    deleteCheckIn: jest.fn(), deleteIntention: jest.fn(), listCheckInDrafts: jest.fn(),
    listCheckIns: jest.fn(async () => [
        { id: 'c-full', type: 'evening', title: 'Evening career reset',
          summary: 'A velvet thunderstorm', status: 'completed', createdAt: 1, updatedAt: 1,
          messages: [
            { id: 'c1', role: 'user', content: 'A velvet thunderstorm rolled in.', timestamp: 1 },
            { id: 'c2', role: 'assistant', content: 'Tell me more about the papaya sky.', timestamp: 1 },
          ] },
        { id: 'c-draft', type: 'morning', title: 'Morning draft', summary: 'draft',
          status: 'draft', createdAt: 1, updatedAt: 1,
          messages: [{ id: 'cd1', role: 'user', content: 'A secret zephyr check-in.', timestamp: 1 }] },
    ]),
    listCompletedCheckIns: jest.fn(), listIntentions: jest.fn(async () => []),
    updateCheckIn: jest.fn(), updateIntention: jest.fn(),
}));

import { cleanup, renderHook, waitFor } from '@testing-library/react-native';
import { useHistoryFeed } from '@/hooks/history/useHistoryFeed';
import {
    activateAccount,
    clearActiveAccount,
} from '@/services/account/accountRuntime';

const listEntriesMock = jest.requireMock('@/services/journal/journalStorage')
    .listEntries as jest.Mock<Promise<JournalEntry[]>, []>;
const listCheckInsMock = jest.requireMock('@/services/intentions/intentionsStorage')
    .listCheckIns as jest.Mock<Promise<IntentionCheckIn[]>, []>;

function ids(sections: ReturnType<typeof useHistoryFeed>['sections']): string[] {
    return sections.flatMap((section) => section.items.map((item) => item.id));
}

describe('useHistoryFeed memoized full-corpus search', () => {
    beforeEach(async () => {
        cleanup();
        jest.clearAllMocks();
        listEntriesMock.mockImplementation(async () => journalRows);
        listCheckInsMock.mockImplementation(async () => checkInRows);
        await activateAccount('user-a');
    });

    afterEach(async () => {
        cleanup();
        await clearActiveAccount();
    });

    it('exposes searchSections bound to the loaded collections', async () => {
        const { result } = renderHook(() => useHistoryFeed());
        await waitFor(() => expect(result.current.sections.length).toBeGreaterThan(0));
        expect(typeof result.current.searchSections).toBe('function');
        expect(ids(result.current.sections)).toEqual(
            expect.arrayContaining(['journal-j-full', 'checkin-c-full'])
        );
        expect(result.current.sections.every((s) =>
            s.items.every((item) => typeof item.searchableText === 'string'))).toBe(true);
    });

    it('finds a later user turn, an assistant reply, analysis text and a check-in body', async () => {
        const { result } = renderHook(() => useHistoryFeed());
        await waitFor(() => expect(result.current.sections.length).toBeGreaterThan(0));
        const search = result.current.searchSections;
        expect(ids(search('quicksilver lantern'))).toEqual(['journal-j-full']);
        expect(ids(search('nocturnal accordion'))).toEqual(['journal-j-full']);
        expect(ids(search('marigold'))).toEqual(['journal-j-full']);
        expect(ids(search('papaya sky'))).toEqual(['checkin-c-full']);
    });

    it('returns all sections for a blank query and none for a miss', async () => {
        const { result } = renderHook(() => useHistoryFeed());
        await waitFor(() => expect(result.current.sections.length).toBeGreaterThan(0));
        expect(result.current.searchSections('   ')).toEqual(result.current.sections);
        expect(result.current.searchSections('zephyr-nonexistent')).toEqual([]);
    });

    it('keeps drafts out of the corpus and reuses one memoized matcher and one read', async () => {
        const { result, rerender } = renderHook(() => useHistoryFeed());
        await waitFor(() => expect(result.current.sections.length).toBeGreaterThan(0));
        const matcher = result.current.searchSections;
        expect(ids(matcher('secret zephyr'))).toEqual([]);
        rerender({});
        expect(result.current.searchSections).toBe(matcher);
        expect(listEntriesMock).toHaveBeenCalledTimes(1);
        expect(listCheckInsMock).toHaveBeenCalledTimes(1);
    });
});