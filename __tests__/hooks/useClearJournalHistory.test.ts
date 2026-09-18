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




import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useClearJournalHistory } from '../../hooks/journal/useClearJournalHistory';
import { createEntry, listEntries } from '../../services/journal/journalStorage';
import { createCheckIn, listCheckIns } from '../../services/intentions/intentionsStorage';
import { listMemoryAtoms } from '../../services/memory/localMemory';
import { listMemoryFiles } from '../../services/memory/memoryFiles';
import {
    applyIdentityPatch,
    getIdentityProfile,
    profileHasIdentity,
} from '../../services/memory/identityProfile';
import { loadSessions } from '../../services/ai/sessionStorage';
import {
    loadCachedInsights,
    saveCachedInsights,
} from '../../services/insights/weeklyInsightsStorage';
import {
    listSavedInsights,
    createSavedInsight,
} from '../../services/saved-insights/savedInsightsStorage';
import { activateAccount, clearActiveAccount } from '../../services/account/accountRuntime';
import * as journalStorage from '../../services/journal/journalStorage';

describe('useClearJournalHistory', () => {
    beforeEach(async () => {
        mockAsyncStorageStore.clear();
        // Clear the direct AI key so a live .env EXPO_PUBLIC_NANO_GPT_API_KEY
        // cannot make the memory-atom extraction on createEntry/createCheckIn
        // hit the real AI provider (not mocked here) and hang the suite.
        delete process.env.EXPO_PUBLIC_NANO_GPT_API_KEY;
        delete process.env.EXPO_PUBLIC_NANO_GPT_API_BASE_URL;
        await activateAccount('clear-history-user');
    });

    afterEach(async () => {
        await clearActiveAccount();
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
        await applyIdentityPatch({ preferredName: 'Sigurd', source: 'manual' });
        expect(profileHasIdentity(await getIdentityProfile())).toBe(true);

        const { result } = renderHook(() => useClearJournalHistory());

        await act(async () => {
            await result.current.clearAll();
        });

        await waitFor(() => expect(result.current.isClearing).toBe(false));

        expect(await listEntries()).toEqual([]);
        expect(await listCheckIns()).toEqual([]);
        expect(await listMemoryAtoms()).toEqual([]);
        // Memory files are journal-derived: finished sessions stage them.
        expect(await listMemoryFiles({ limit: 50 })).toEqual([]);
        expect(profileHasIdentity(await getIdentityProfile())).toBe(false);
        expect(await loadSessions()).toEqual([]);
        expect(await loadCachedInsights('2026-W01')).toBeNull();
        expect(await listSavedInsights()).toEqual([]);
    });

    it('survives a transient account-lease abort mid-wipe and reports no failed steps (DEF-011)', async () => {
        await createEntry({
            title: 'Entry before the gateway died',
            status: 'completed',
            messages: [{ id: 'm1', role: 'user', content: 'Hello', timestamp: 1 }],
        });

        // A dead auth gateway aborts an in-flight account lease exactly once.
        const realClear = journalStorage.clearAllEntries;
        const flaky = jest.spyOn(journalStorage, 'clearAllEntries')
            .mockRejectedValueOnce(new Error('Account operation was aborted.'))
            .mockImplementation(realClear);

        const { result } = renderHook(() => useClearJournalHistory());

        let outcome: { failedSteps: string[] } | undefined;
        await act(async () => {
            outcome = await result.current.clearAll();
        });

        expect(outcome?.failedSteps).toEqual([]);
        expect(flaky).toHaveBeenCalledTimes(2);
        expect(await listEntries()).toEqual([]);
        flaky.mockRestore();
    });

    it('names the groups it could not clear instead of failing silently', async () => {
        const hardFailure = jest.spyOn(journalStorage, 'clearAllEntries')
            .mockRejectedValue(new Error('Disk is full'));

        const { result } = renderHook(() => useClearJournalHistory());

        let outcome: { failedSteps: string[] } | undefined;
        await act(async () => {
            outcome = await result.current.clearAll();
        });

        expect(outcome?.failedSteps).toEqual(['journal entries']);
        hardFailure.mockRestore();
    });
});
