/* eslint-disable import/first */

const mockAsyncStorageStore = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn((key: string) => Promise.resolve(mockAsyncStorageStore.get(key) ?? null)),
        setItem: jest.fn((key: string, value: string) => {
            mockAsyncStorageStore.set(key, value);
            return Promise.resolve();
        }),
        removeItem: jest.fn((key: string) => {
            mockAsyncStorageStore.delete(key);
            return Promise.resolve();
        }),
    },
}));

jest.mock('../../services/journal/journalRemote', () => ({
    JOURNAL_TABLE: 'journal_entries',
    deleteRemoteJournalEntries: jest.fn(() => Promise.resolve(true)),
    fetchRemoteJournalEntries: jest.fn(() => Promise.resolve(null)),
    mergeEntries: jest.fn((local: object) => local),
    pushJournalEntries: jest.fn(() => Promise.resolve(false)),
    queueJournalEntryDelete: jest.fn(() => Promise.resolve()),
    queueJournalEntryUpsert: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../services/supabase/syncQueue', () => ({
    removeSyncTasksForTable: jest.fn(() => Promise.resolve()),
    enqueueSyncTask: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../services/intentions/intentionsRemote', () => ({
    fetchRemoteCheckIns: jest.fn(() => Promise.resolve(null)),
    fetchRemoteIntentions: jest.fn(() => Promise.resolve(null)),
    mergeCheckIns: jest.fn((local: object) => local),
    mergeIntentions: jest.fn((local: object) => local),
    pushCheckIns: jest.fn(() => Promise.resolve(false)),
    pushIntentions: jest.fn(() => Promise.resolve(false)),
    queueCheckInDelete: jest.fn(() => Promise.resolve()),
    queueCheckInUpsert: jest.fn(() => Promise.resolve()),
    queueIntentionDelete: jest.fn(() => Promise.resolve()),
    queueIntentionUpsert: jest.fn(() => Promise.resolve()),
}));

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useClearJournalHistory } from '../../hooks/journal/useClearJournalHistory';
import { createEntry, listEntries } from '../../services/journal/journalStorage';
import { createCheckIn, listCheckIns } from '../../services/intentions/intentionsStorage';
import { listMemoryAtoms } from '../../services/memory/localMemory';
import { loadSessions } from '../../services/ai/sessionStorage';
import {
    loadCachedInsights,
    saveCachedInsights,
} from '../../services/insights/weeklyInsightsStorage';
import {
    listSavedInsights,
    createSavedInsight,
} from '../../services/saved-insights/savedInsightsStorage';

describe('useClearJournalHistory', () => {
    beforeEach(() => {
        mockAsyncStorageStore.clear();
    });

    it('clears journal entries, intention check-ins, memories, chat sessions, insights, and saved insights', async () => {
        await createEntry({
            title: 'Journal entry',
            status: 'completed',
            messages: [{ id: 'm1', role: 'user', content: 'Hello', timestamp: 1 }],
        });

        await createCheckIn({
            type: 'morning',
            title: 'Morning intention',
            summary: 'Stay focused.',
            mood: 'Reflective',
            status: 'completed',
            messages: [{ id: 'm2', role: 'user', content: 'Stay focused.', timestamp: 2 }],
        });

        const atomsBefore = await listMemoryAtoms();
        expect(atomsBefore.length).toBeGreaterThan(0);

        await saveCachedInsights(
            '2026-W01',
            {
                weeklySummary: 'Week summary',
                emotionalLandscape: [],
                keyThemes: ['Focus'],
                castOfCharacters: [],
            },
            1
        );
        await createSavedInsight({ question: 'Q?', sourceDate: '2026-01-01' });

        const { result } = renderHook(() => useClearJournalHistory());

        await act(async () => {
            await result.current.clearAll();
        });

        await waitFor(() => expect(result.current.isClearing).toBe(false));

        expect(await listEntries()).toEqual([]);
        expect(await listCheckIns()).toEqual([]);
        expect(await listMemoryAtoms()).toEqual([]);
        expect(await loadSessions()).toEqual([]);
        expect(await loadCachedInsights('2026-W01')).toBeNull();
        expect(await listSavedInsights()).toEqual([]);
    });
});
