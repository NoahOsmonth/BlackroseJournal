/* eslint-disable import/first */

const mockValues = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(async (key: string) => mockValues.get(key) ?? null),
        setItem: jest.fn(async (key: string, value: string) => {
            mockValues.set(key, value);
        }),
        removeItem: jest.fn(async (key: string) => {
            mockValues.delete(key);
        }),
    },
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
    createGoal,
    listGoals,
    migrateLegacyGoalsToActiveAccount,
} from '../../../services/goals/goalsStorage';

describe('account-scoped goals storage', () => {
    beforeEach(async () => {
        mockValues.clear();
        await activateAccount('user-a');
    });

    afterEach(async () => {
        await clearActiveAccount();
    });

    it('isolates goals when the active account changes', async () => {
        await createGoal({ title: 'Private goal', type: 'goal', dateKey: '2026-08-24' });

        await activateAccount('user-b');

        await expect(listGoals()).resolves.toEqual([]);
    });

    it('moves the legacy owner key into the confirmed account namespace', async () => {
        mockValues.set('@goals', JSON.stringify({
            legacy: {
                id: 'legacy',
                title: 'Legacy goal',
                type: 'goal',
                dateKey: '2026-08-24',
                completed: false,
                createdAt: 1,
                updatedAt: 1,
            },
        }));

        await migrateLegacyGoalsToActiveAccount();

        await expect(listGoals()).resolves.toEqual([
            expect.objectContaining({ id: 'legacy' }),
        ]);
        expect(mockValues.has('@goals')).toBe(false);
    });
});
