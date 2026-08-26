/* eslint-disable import/first */

const mockValues = new Map<string, string>();
let mockDelayedRead: { promise: Promise<void>; resolve: () => void } | null = null;
let mockDelayedReadStarted: (() => void) | null = null;
let mockDelayedKey: string | null = null;

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(async (key: string) => {
            if (key === mockDelayedKey && mockDelayedRead) {
                mockDelayedReadStarted?.();
                await mockDelayedRead.promise;
            }
            return mockValues.get(key) ?? null;
        }),
        setItem: jest.fn(async (key: string, value: string) => {
            mockValues.set(key, value);
        }),
        removeItem: jest.fn(async (key: string) => {
            mockValues.delete(key);
        }),
    },
}));

jest.mock('../../../services/happiness-recipe/happinessRecipeRemote', () => ({
    loadRemoteRecipeItems: jest.fn(async () => null),
    queueRecipeItemDelete: jest.fn(async () => undefined),
    queueRecipeItemUpsert: jest.fn(async () => undefined),
}));
jest.mock('../../../services/insights/weeklyInsightsRemote', () => ({
    loadRemoteWeeklyInsights: jest.fn(async () => null),
    saveRemoteWeeklyInsights: jest.fn(async () => undefined),
    deleteRemoteWeeklyInsights: jest.fn(async () => undefined),
}));
jest.mock('../../../services/personas/personasRemote', () => ({
    fetchRemotePersonas: jest.fn(async () => null),
    mergePersonas: jest.fn((local: object) => local),
    pushPersonas: jest.fn(async () => false),
    queuePersonaDelete: jest.fn(async () => undefined),
    queuePersonaUpsert: jest.fn(async () => undefined),
}));
jest.mock('../../../services/saved-insights/savedInsightsRemote', () => ({
    fetchRemoteSavedInsights: jest.fn(async () => null),
    mergeSavedInsights: jest.fn((local: object) => local),
    pushSavedInsights: jest.fn(async () => false),
    queueSavedInsightDelete: jest.fn(async () => undefined),
    queueSavedInsightUpsert: jest.fn(async () => undefined),
}));
jest.mock('../../../services/goals/goalsRemote', () => ({
    fetchRemoteGoals: jest.fn(async () => null),
    mergeGoals: jest.fn((local: object) => local),
    pushGoals: jest.fn(async () => false),
    queueGoalDelete: jest.fn(async () => undefined),
    queueGoalUpsert: jest.fn(async () => undefined),
}));

import { activateAccount, clearActiveAccount } from '../../../services/account/accountRuntime';
import {
    addRecipeItem,
} from '../../../services/happiness-recipe/happinessRecipeStorage';
import { saveCachedInsights } from '../../../services/insights/weeklyInsightsStorage';
import { createPersona } from '../../../services/personas/personasStorage';
import { createSavedInsight } from '../../../services/saved-insights/savedInsightsStorage';
import { createGoal } from '../../../services/goals/goalsStorage';
import { getAccountScopedStorageKeyForAccount } from '../../../services/account/accountScopedStorage';
import type { WeeklyInsightsResult } from '../../../services/ai/insightsTypes';

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((nextResolve) => { resolve = nextResolve; });
    return { promise, resolve };
}

const insights: WeeklyInsightsResult = {
    emotionalLandscape: [],
    keyThemes: [],
    castOfCharacters: [],
    weeklySummary: 'A private week.',
};

async function expectMutationAbortedAfterSwitch(
    start: () => Promise<unknown>,
    remoteCall: jest.Mock<Promise<void>, unknown[]>,
    releaseRemote: () => void,
    ownerKey: string,
): Promise<void> {
    await activateAccount('account-a');
    const pending = start();
    while (remoteCall.mock.calls.length === 0) await Promise.resolve();
    const switching = activateAccount('account-b');
    releaseRemote();
    await expect(pending).rejects.toThrow('Account operation was aborted');
    await switching;
    expect(mockValues.has(getAccountScopedStorageKeyForAccount(ownerKey, 'account-b'))).toBe(false);
}

describe('account-bound owner mutation races', () => {
    const originalProvider = process.env.EXPO_PUBLIC_DATA_PROVIDER;

    beforeEach(async () => {
        await clearActiveAccount();
        mockValues.clear();
        mockDelayedRead = null;
        mockDelayedReadStarted = null;
        mockDelayedKey = null;
        process.env.EXPO_PUBLIC_DATA_PROVIDER = 'remote';
        jest.clearAllMocks();
    });

    afterEach(async () => {
        await clearActiveAccount();
        if (originalProvider === undefined) delete process.env.EXPO_PUBLIC_DATA_PROVIDER;
        else process.env.EXPO_PUBLIC_DATA_PROVIDER = originalProvider;
    });

    it('aborts a happiness recipe mutation after the account switch', async () => {
        const { queueRecipeItemUpsert } = jest.requireMock(
            '../../../services/happiness-recipe/happinessRecipeRemote',
        ) as { queueRecipeItemUpsert: jest.Mock<Promise<void>, unknown[]> };
        const release = deferred();
        queueRecipeItemUpsert.mockImplementation(() => release.promise);
        await expectMutationAbortedAfterSwitch(
            () => addRecipeItem('habit', 'Drink water'),
            queueRecipeItemUpsert,
            release.resolve,
            'happiness_recipe_items',
        );
    });

    it('aborts a weekly insights mutation after the account switch', async () => {
        const { saveRemoteWeeklyInsights } = jest.requireMock(
            '../../../services/insights/weeklyInsightsRemote',
        ) as { saveRemoteWeeklyInsights: jest.Mock<Promise<void>, unknown[]> };
        const release = deferred();
        saveRemoteWeeklyInsights.mockImplementation(() => release.promise);
        await expectMutationAbortedAfterSwitch(
            () => saveCachedInsights('2026-W34', insights, 1),
            saveRemoteWeeklyInsights,
            release.resolve,
            'weekly_insights_cache',
        );
    });

    it('aborts a persona mutation after the account switch', async () => {
        const { queuePersonaUpsert } = jest.requireMock(
            '../../../services/personas/personasRemote',
        ) as { queuePersonaUpsert: jest.Mock<Promise<void>, unknown[]> };
        const release = deferred();
        queuePersonaUpsert.mockImplementation(() => release.promise);
        await expectMutationAbortedAfterSwitch(
            () => createPersona({
                name: 'Private', tagline: 'Private', voice: 'Onyx', prompt: 'Private',
                model: 'model', imagination: 25, avatarKey: 'private',
            }),
            queuePersonaUpsert,
            release.resolve,
            'personas',
        );
    });

    it('aborts a saved insight mutation after the account switch', async () => {
        const { queueSavedInsightUpsert } = jest.requireMock(
            '../../../services/saved-insights/savedInsightsRemote',
        ) as { queueSavedInsightUpsert: jest.Mock<Promise<void>, unknown[]> };
        const release = deferred();
        queueSavedInsightUpsert.mockImplementation(() => release.promise);
        await expectMutationAbortedAfterSwitch(
            () => createSavedInsight({ question: 'Private?', sourceDate: '2026-08-25' }),
            queueSavedInsightUpsert,
            release.resolve,
            'saved_insights',
        );
    });

    it('does not write a goal into B when A is switched during its read', async () => {
        const releaseRead = deferred();
        const readStarted = deferred();
        mockDelayedRead = releaseRead;
        mockDelayedReadStarted = readStarted.resolve;
        mockDelayedKey = getAccountScopedStorageKeyForAccount('@goals', 'account-a');
        await activateAccount('account-a');
        const pending = createGoal({ title: 'A private goal', type: 'goal', dateKey: '2026-08-25' });
        await readStarted.promise;
        const switching = activateAccount('account-b');
        releaseRead.resolve();
        await expect(pending).rejects.toThrow('Account operation was aborted');
        await switching;
        expect(mockValues.has(getAccountScopedStorageKeyForAccount('@goals', 'account-b'))).toBe(false);
    });
});
