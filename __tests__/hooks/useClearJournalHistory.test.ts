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
import {
    listStarredEntryIds,
    setStarredEntryIds,
    subscribeStarredChanges,
} from '../../services/journal/starredEntries';
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
import {
    getWritingGoalSettings,
    setWritingGoalSettings,
    subscribeWritingGoal,
} from '../../services/goals/writingGoalSettings';
import { DEFAULT_WRITING_GOAL } from '../../utils/writingGoal';
import {
    listSavedStarters,
    toggleSavedStarter,
} from '../../services/prompts/savedPromptPacks';
import * as journalStorage from '../../services/journal/journalStorage';

describe('useClearJournalHistory', () => {
    beforeEach(async () => {
        mockAsyncStorageStore.clear();
        // Clear the direct AI key so a live .env EXPO_PUBLIC_AI_CUSTOM_API_KEY
        // cannot make the memory-atom extraction on createEntry/createCheckIn
        // hit the real AI provider (not mocked here) and hang the suite.
        delete process.env.EXPO_PUBLIC_AI_CUSTOM_API_KEY;
        delete process.env.EXPO_PUBLIC_AI_CUSTOM_BASE;
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
        await setStarredEntryIds(['entry-1', 'entry-2']);
        expect(await listStarredEntryIds()).toHaveLength(2);
        await setWritingGoalSettings({ wordsPerDay: 750, restDaysPerWeek: 3 });
        expect(await getWritingGoalSettings()).toEqual({ wordsPerDay: 750, restDaysPerWeek: 3 });
        await toggleSavedStarter('one-thing');
        expect(await listSavedStarters()).toEqual(['one-thing']);
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
        // Stars point at journal entries; leaving them makes the Archive say
        // "2 shown" with an empty list forever (round 34 live QA).
        expect(await listStarredEntryIds()).toEqual([]);
        // The gentle writing goal is user state too: leaving it behind makes
        // an open goal screen keep showing a target from the wiped journal.
        expect(await getWritingGoalSettings()).toEqual(DEFAULT_WRITING_GOAL);
        // Saved starters are user state too: a wiped journal must not keep
        // an open shelf showing favorites (round 44 coupling).
        expect(await listSavedStarters()).toEqual([]);
    });

    it('tells open screens the stars are gone', async () => {
        await setStarredEntryIds(['entry-1']);
        const seen: string[][] = [];
        const unsubscribe = subscribeStarredChanges((ids) => seen.push([...ids]));
        const { result } = renderHook(() => useClearJournalHistory());
        await act(async () => {
            await result.current.clearAll();
        });
        unsubscribe();
        expect(seen).toContainEqual([]);
        expect(await listStarredEntryIds()).toEqual([]);
    });

    it('tells an open goal screen the target is back to the default', async () => {
        await setWritingGoalSettings({ wordsPerDay: 750, restDaysPerWeek: 3 });
        const seen: number[] = [];
        const unsubscribe = subscribeWritingGoal((settings) => seen.push(settings.wordsPerDay));
        const { result } = renderHook(() => useClearJournalHistory());
        await act(async () => {
            await result.current.clearAll();
        });
        unsubscribe();
        expect(seen).toContain(DEFAULT_WRITING_GOAL.wordsPerDay);
        expect(await getWritingGoalSettings()).toEqual(DEFAULT_WRITING_GOAL);
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
