/* eslint-disable import/first */

import type { JournalEntry } from '@/services/journal/journalStorage.types';
import type {
    Intention,
    IntentionCheckIn,
} from '@/services/intentions/intentionsStorage.types';

const journalByAccount: Record<string, JournalEntry[]> = {
    'user-a': [{
        id: 'journal-a',
        title: 'A journal',
        emoji: '🌹',
        messages: [],
        status: 'completed',
        createdAt: 1,
        updatedAt: 1,
    }],
    'user-b': [{
        id: 'journal-b',
        title: 'B journal',
        emoji: '🌹',
        messages: [],
        status: 'completed',
        createdAt: 2,
        updatedAt: 2,
    }],
};

const intentionByAccount: Record<string, Intention[]> = {
    'user-a': [{
        id: 'intention-a',
        title: 'A intention',
        description: 'Private to A',
        area: 'wellbeing',
        createdAt: 1,
        updatedAt: 1,
    }],
    'user-b': [{
        id: 'intention-b',
        title: 'B intention',
        description: 'Private to B',
        area: 'career',
        createdAt: 2,
        updatedAt: 2,
    }],
};

const checkInByAccount: Record<string, IntentionCheckIn[]> = {
    'user-a': [{
        id: 'check-in-a',
        type: 'morning',
        title: 'A check-in',
        summary: 'Private to A',
        status: 'completed',
        createdAt: 1,
        updatedAt: 1,
    }],
    'user-b': [{
        id: 'check-in-b',
        type: 'evening',
        title: 'B check-in',
        summary: 'Private to B',
        status: 'completed',
        createdAt: 2,
        updatedAt: 2,
    }],
};

const mockCurrentAccountId = (): string | null => (
    jest.requireActual('@/services/account/accountRuntime').getActiveAccountId()
);

jest.mock('@/services/journal/journalStorage', () => ({
    createEntry: jest.fn(),
    deleteEntry: jest.fn(),
    getEntry: jest.fn(),
    listCompleted: jest.fn(async () => journalByAccount[mockCurrentAccountId() ?? ''] ?? []),
    listDrafts: jest.fn(async () => []),
    listEntries: jest.fn(async () => journalByAccount[mockCurrentAccountId() ?? ''] ?? []),
    updateEntry: jest.fn(),
}));

jest.mock('@/services/intentions/intentionsStorage', () => ({
    archiveIntention: jest.fn(),
    createCheckIn: jest.fn(),
    createIntention: jest.fn(),
    deleteCheckIn: jest.fn(),
    deleteIntention: jest.fn(),
    listCheckInDrafts: jest.fn(async () => []),
    listCheckIns: jest.fn(async () => checkInByAccount[mockCurrentAccountId() ?? ''] ?? []),
    listCompletedCheckIns: jest.fn(async () => checkInByAccount[mockCurrentAccountId() ?? ''] ?? []),
    listIntentions: jest.fn(async () => intentionByAccount[mockCurrentAccountId() ?? ''] ?? []),
    updateCheckIn: jest.fn(),
    updateIntention: jest.fn(),
}));

import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';
import { useIntentionCheckIns } from '@/hooks/intentions/useIntentionCheckIns';
import { useIntentions } from '@/hooks/intentions/useIntentions';
import { useJournalEntries } from '@/hooks/journal/useJournalEntries';
import {
    activateAccount,
    clearActiveAccount,
} from '@/services/account/accountRuntime';

describe('account-bound collection hooks', () => {
    beforeEach(async () => {
        cleanup();
        await activateAccount('user-a');
    });

    afterEach(async () => {
        cleanup();
        await clearActiveAccount();
    });

    it.each([
        ['journal', () => ({ items: useJournalEntries().entries })],
        ['intentions', () => ({ items: useIntentions().intentions })],
        ['check-ins', () => ({ items: useIntentionCheckIns().checkIns })],
    ] as const)('rebinds mounted %s when the active account changes', async (_name, useCollection) => {
        const { result } = renderHook(() => useCollection());

        await waitFor(() => expect(result.current.items[0]?.id).toContain('-a'));

        await act(async () => {
            await activateAccount('user-b');
        });

        await waitFor(() => expect(result.current.items[0]?.id).toContain('-b'));
        expect(result.current.items.some((item) => item.id.includes('-a'))).toBe(false);
    });
});
