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


import { activateAccount, clearActiveAccount } from '../../../services/account/accountRuntime';
import { createGoal } from '../../../services/goals/goalsStorage';
import { addRecipeItem } from '../../../services/happiness-recipe/happinessRecipeStorage';
import { saveCachedInsights } from '../../../services/insights/weeklyInsightsStorage';
import { createPersona } from '../../../services/personas/personasStorage';
import { createSavedInsight } from '../../../services/saved-insights/savedInsightsStorage';
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

describe('account-bound owner mutation races', () => {
    beforeEach(async () => {
        await clearActiveAccount();
        mockValues.clear();
        mockDelayedRead = null;
        mockDelayedReadStarted = null;
        mockDelayedKey = null;
        jest.clearAllMocks();
    });

    afterEach(async () => {
        await clearActiveAccount();
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

    it('keeps local-only writes working for the active account without any network step', async () => {
        await activateAccount('account-a');

        await addRecipeItem('habit', 'Drink water');
        await saveCachedInsights('2026-W34', insights, 1);
        await createPersona({
            name: 'Private', tagline: 'Private', voice: 'Onyx', prompt: 'Private',
            model: 'model', imagination: 25, avatarKey: 'private',
        });
        await createSavedInsight({ question: 'Private?', sourceDate: '2026-08-25' });

        expect(mockValues.has(getAccountScopedStorageKeyForAccount('happiness_recipe_items', 'account-a'))).toBe(true);
        expect(mockValues.has(getAccountScopedStorageKeyForAccount('weekly_insights_cache', 'account-a'))).toBe(true);
        expect(mockValues.has(getAccountScopedStorageKeyForAccount('personas', 'account-a'))).toBe(true);
        expect(mockValues.has(getAccountScopedStorageKeyForAccount('saved_insights', 'account-a'))).toBe(true);
    });
});
