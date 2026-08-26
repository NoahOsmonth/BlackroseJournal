/* eslint-disable import/first */

const mockValues = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn((key: string) => Promise.resolve(mockValues.get(key) ?? null)),
        setItem: jest.fn((key: string, value: string) => {
            mockValues.set(key, value);
            return Promise.resolve();
        }),
        removeItem: jest.fn((key: string) => {
            mockValues.delete(key);
            return Promise.resolve();
        }),
    },
}));

jest.mock('../../../services/personas/personasRemote', () => ({
    fetchRemotePersonas: jest.fn(),
    mergePersonas: jest.fn((_local: object, remote: object) => remote),
    pushPersonas: jest.fn(() => Promise.resolve(false)),
    queuePersonaDelete: jest.fn(() => Promise.resolve()),
    queuePersonaUpsert: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../services/saved-insights/savedInsightsRemote', () => ({
    fetchRemoteSavedInsights: jest.fn(),
    mergeSavedInsights: jest.fn((_local: object, remote: object) => remote),
    pushSavedInsights: jest.fn(() => Promise.resolve(false)),
    queueSavedInsightDelete: jest.fn(() => Promise.resolve()),
    queueSavedInsightUpsert: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../services/happiness-recipe/happinessRecipeRemote', () => ({
    loadRemoteRecipeItems: jest.fn(),
    queueRecipeItemDelete: jest.fn(() => Promise.resolve()),
    queueRecipeItemUpsert: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../services/insights/weeklyInsightsRemote', () => ({
    loadRemoteWeeklyInsights: jest.fn(),
    saveRemoteWeeklyInsights: jest.fn(() => Promise.resolve()),
    deleteRemoteWeeklyInsights: jest.fn(() => Promise.resolve()),
}));

import { activateAccount, clearActiveAccount } from '../../../services/account/accountRuntime';
import { listPersonas } from '../../../services/personas/personasStorage';
import { fetchRemotePersonas } from '../../../services/personas/personasRemote';
import { listSavedInsights } from '../../../services/saved-insights/savedInsightsStorage';
import { fetchRemoteSavedInsights } from '../../../services/saved-insights/savedInsightsRemote';
import { loadRecipeItems } from '../../../services/happiness-recipe/happinessRecipeStorage';
import { loadRemoteRecipeItems } from '../../../services/happiness-recipe/happinessRecipeRemote';
import { loadCachedInsights } from '../../../services/insights/weeklyInsightsStorage';
import { loadRemoteWeeklyInsights } from '../../../services/insights/weeklyInsightsRemote';

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
    return { promise, resolve };
}

async function expectSwitchDiscardsRemote<T>(
    start: () => Promise<T>,
    remoteCall: { mock: { calls: unknown[][] } },
    releaseRemote: () => void,
    ownerKey: string,
): Promise<void> {
    await activateAccount('account-a');
    const pending = start();
    while (remoteCall.mock.calls.length === 0) {
        await Promise.resolve();
    }
    const switching = activateAccount('account-b');
    await Promise.resolve();
    releaseRemote();
    await expect(pending).rejects.toThrow('Account operation was aborted');
    await switching;
    expect(mockValues.has(`@blackrose_account:v1:account-a:${ownerKey}`)).toBe(false);
    expect(mockValues.has(`@blackrose_account:v1:account-b:${ownerKey}`)).toBe(false);
}

describe('account-bound remote/local owner workflows', () => {
    beforeEach(async () => {
        await clearActiveAccount();
        mockValues.clear();
        jest.clearAllMocks();
        process.env.EXPO_PUBLIC_DATA_PROVIDER = 'remote';
    });

    afterEach(async () => {
        await clearActiveAccount();
        delete process.env.EXPO_PUBLIC_DATA_PROVIDER;
    });

    it('discards a stale personas pull during an account switch', async () => {
        const remote = deferred<[{ id: string; updatedAt: number }]>();
        jest.mocked(fetchRemotePersonas).mockReturnValue(
                    remote.promise as unknown as ReturnType<typeof fetchRemotePersonas>,
                );
        await expectSwitchDiscardsRemote(
            listPersonas,
            jest.mocked(fetchRemotePersonas),
            () => remote.resolve([{ id: 'persona-a', updatedAt: 1 }]),
            'personas',
        );
    });

    it('discards a stale saved-insights pull during an account switch', async () => {
        const remote = deferred<[{ id: string; updatedAt: number }]>();
        jest.mocked(fetchRemoteSavedInsights).mockReturnValue(
            remote.promise as unknown as ReturnType<typeof fetchRemoteSavedInsights>,
        );
        await expectSwitchDiscardsRemote(
            listSavedInsights,
            jest.mocked(fetchRemoteSavedInsights),
            () => remote.resolve([{ id: 'insight-a', updatedAt: 1 }]),
            'saved_insights',
        );
    });

    it('discards stale happiness recipe items during an account switch', async () => {
        const remote = deferred<[]>();
        jest.mocked(loadRemoteRecipeItems).mockReturnValue(remote.promise);
        await expectSwitchDiscardsRemote(
            loadRecipeItems,
            jest.mocked(loadRemoteRecipeItems),
            () => remote.resolve([]),
            'happiness_recipe_items',
        );
    });

    it('discards stale weekly insights during an account switch', async () => {
        const remote = deferred<null>();
        jest.mocked(loadRemoteWeeklyInsights).mockReturnValue(remote.promise);
        await expectSwitchDiscardsRemote(
            () => loadCachedInsights('2026-W34'),
            jest.mocked(loadRemoteWeeklyInsights),
            () => remote.resolve(null),
            'weekly_insights_cache',
        );
    });
});
