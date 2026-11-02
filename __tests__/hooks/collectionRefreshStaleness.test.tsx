/* eslint-disable import/first */

/**
 * Guards the two tab-switch optimizations these hooks carry:
 *
 *  1. One storage read per collection. `listDrafts`/`listCompleted` and
 *     `listCompletedCheckIns`/`listCheckInDrafts` each re-read the same key, so
 *     asking for all three lists tripled the parse work on every focus.
 *  2. Stale-while-refresh. A focus refresh must not flip `isLoading` back to
 *     `true` once data exists — that swap is what made Today flash its skeleton
 *     on every tab switch.
 */

import type { JournalEntry } from '@/services/journal/journalStorage.types';
import type { IntentionCheckIn } from '@/services/intentions/intentionsStorage.types';

function buildEntry(id: string, status: 'draft' | 'completed'): JournalEntry {
    return {
        id,
        title: id,
        emoji: '🌹',
        messages: [],
        status,
        createdAt: 1,
        updatedAt: 1,
    };
}

function buildCheckIn(id: string, status: 'draft' | 'completed'): IntentionCheckIn {
    return {
        id,
        type: 'morning',
        title: id,
        summary: id,
        status,
        createdAt: 1,
        updatedAt: 1,
    };
}

const mockJournalRows = [
    buildEntry('journal-draft', 'draft'),
    buildEntry('journal-completed', 'completed'),
];

const mockCheckInRows = [
    buildCheckIn('checkin-draft', 'draft'),
    buildCheckIn('checkin-completed', 'completed'),
];

jest.mock('@/services/journal/journalStorage', () => ({
    createEntry: jest.fn(),
    deleteEntry: jest.fn(),
    getEntry: jest.fn(),
    // The status-splitting helpers must stay unused: each one re-reads the
    // index plus every shard.
    listCompleted: jest.fn(() => {
        throw new Error('useJournalEntries must not call listCompleted');
    }),
    listDrafts: jest.fn(() => {
        throw new Error('useJournalEntries must not call listDrafts');
    }),
    listEntries: jest.fn(async () => mockJournalRows),
    updateEntry: jest.fn(),
}));

jest.mock('@/services/intentions/intentionsStorage', () => ({
    archiveIntention: jest.fn(),
    createCheckIn: jest.fn(),
    createIntention: jest.fn(),
    deleteCheckIn: jest.fn(),
    deleteIntention: jest.fn(),
    listCheckInDrafts: jest.fn(() => {
        throw new Error('useIntentionCheckIns must not call listCheckInDrafts');
    }),
    listCheckIns: jest.fn(async () => mockCheckInRows),
    listCompletedCheckIns: jest.fn(() => {
        throw new Error('useIntentionCheckIns must not call listCompletedCheckIns');
    }),
    listIntentions: jest.fn(async () => []),
    updateCheckIn: jest.fn(),
    updateIntention: jest.fn(),
}));

import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';
import { useIntentionCheckIns } from '@/hooks/intentions/useIntentionCheckIns';
import { useJournalEntries } from '@/hooks/journal/useJournalEntries';
import { useHistoryFeed } from '@/hooks/history/useHistoryFeed';
import {
    activateAccount,
    clearActiveAccount,
} from '@/services/account/accountRuntime';

const listEntriesMock = jest.requireMock('@/services/journal/journalStorage')
    .listEntries as jest.Mock<Promise<JournalEntry[]>, []>;
const listCheckInsMock = jest.requireMock('@/services/intentions/intentionsStorage')
    .listCheckIns as jest.Mock<Promise<IntentionCheckIn[]>, []>;

describe('collection hooks: single read per key', () => {
    beforeEach(async () => {
        cleanup();
        jest.clearAllMocks();
        listEntriesMock.mockImplementation(async () => mockJournalRows);
        listCheckInsMock.mockImplementation(async () => mockCheckInRows);
        await activateAccount('user-a');
    });

    afterEach(async () => {
        cleanup();
        await clearActiveAccount();
    });

    it('splits one journal read into drafts and completed', async () => {
        const { result } = renderHook(() => useJournalEntries());

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.entries.map((entry) => entry.id))
            .toEqual(['journal-draft', 'journal-completed']);
        expect(result.current.drafts.map((entry) => entry.id)).toEqual(['journal-draft']);
        expect(result.current.completed.map((entry) => entry.id)).toEqual(['journal-completed']);
        expect(listEntriesMock).toHaveBeenCalledTimes(1);
    });

    it('splits one check-in read into drafts and completed', async () => {
        const { result } = renderHook(() => useIntentionCheckIns());

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.drafts.map((item) => item.id)).toEqual(['checkin-draft']);
        expect(result.current.completed.map((item) => item.id)).toEqual(['checkin-completed']);
        expect(listCheckInsMock).toHaveBeenCalledTimes(1);
    });

    it('keeps the Archive header draft count off a second pair of hook instances', async () => {
        const { result } = renderHook(() => useHistoryFeed());

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.draftCount).toBe(2);
        expect(listEntriesMock).toHaveBeenCalledTimes(1);
        expect(listCheckInsMock).toHaveBeenCalledTimes(1);
    });
});

describe('collection hooks: refresh keeps loaded data on screen', () => {
    beforeEach(async () => {
        cleanup();
        jest.clearAllMocks();
        await activateAccount('user-a');
    });

    afterEach(async () => {
        cleanup();
        await clearActiveAccount();
    });

    it('does not re-enter the loading state when refreshing loaded journal entries', async () => {
        listEntriesMock.mockImplementation(async () => mockJournalRows);
        const { result } = renderHook(() => useJournalEntries());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        let release: ((rows: JournalEntry[]) => void) | undefined;
        listEntriesMock.mockImplementationOnce(() => new Promise<JournalEntry[]>((resolve) => {
            release = resolve;
        }));

        act(() => {
            void result.current.refresh();
        });

        expect(result.current.isLoading).toBe(false);

        await act(async () => {
            release?.(mockJournalRows);
        });

        expect(result.current.isLoading).toBe(false);
        expect(result.current.completed.map((entry) => entry.id)).toEqual(['journal-completed']);
    });

    it('does not re-enter the loading state when refreshing loaded check-ins', async () => {
        listCheckInsMock.mockImplementation(async () => mockCheckInRows);
        const { result } = renderHook(() => useIntentionCheckIns());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        let release: ((rows: IntentionCheckIn[]) => void) | undefined;
        listCheckInsMock.mockImplementationOnce(() => new Promise<IntentionCheckIn[]>((resolve) => {
            release = resolve;
        }));

        act(() => {
            void result.current.refresh();
        });

        expect(result.current.isLoading).toBe(false);

        await act(async () => {
            release?.(mockCheckInRows);
        });

        expect(result.current.isLoading).toBe(false);
    });

    it('shows the loading state again for a different account', async () => {
        listEntriesMock.mockImplementation(async () => mockJournalRows);
        const { result } = renderHook(() => useJournalEntries());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        let release: ((rows: JournalEntry[]) => void) | undefined;
        listEntriesMock.mockImplementationOnce(() => new Promise<JournalEntry[]>((resolve) => {
            release = resolve;
        }));

        await act(async () => {
            await activateAccount('user-b');
        });

        // A different account's rows are not "already loaded" data.
        await waitFor(() => expect(result.current.isLoading).toBe(true));

        await act(async () => {
            release?.([buildEntry('journal-b', 'completed')]);
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.completed.map((entry) => entry.id)).toEqual(['journal-b']);
    });
});
