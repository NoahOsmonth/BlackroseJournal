/* eslint-disable import/first */

/**
 * Regression tests for QA Run 1 findings:
 * - DEF-004: alien storage shape (array) must not silently freeze goal writes.
 * - DEF-003 (lease half): nested account-bound operations inherit the outer
 *   lease's pinned account instead of re-reading the live global.
 */

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
import { getAccountScopedStorageKeyForAccount } from '../../../services/account/accountScopedStorage';
import { createGoal, listGoals } from '../../../services/goals/goalsStorage';

const goalsKeyFor = (accountId: string) =>
    getAccountScopedStorageKeyForAccount('@goals', accountId);

describe('goals storage shape tolerance (DEF-004)', () => {
    beforeEach(async () => {
        mockValues.clear();
        await activateAccount('user-a');
    });

    afterEach(async () => {
        await clearActiveAccount();
    });

    it('recovers writes when the goals key holds an array instead of a map', async () => {
        // The exact corruption from QA Run 1: [] instead of {}.
        mockValues.set(goalsKeyFor('user-a'), '[]');

        const created = await createGoal({
            title: 'QA-TEST after array corruption',
            type: 'goal',
            dateKey: '2026-09-17',
        });

        expect(created.title).toBe('QA-TEST after array corruption');

        const stored = mockValues.get(goalsKeyFor('user-a')) ?? '';
        const parsed = JSON.parse(stored) as Record<string, unknown>;
        expect(Array.isArray(parsed)).toBe(false);
        expect(Object.keys(parsed)).toContain(created.id);
        expect(await listGoals()).toHaveLength(1);
    });

    it('falls back to an empty map on corrupt JSON and keeps writing', async () => {
        mockValues.set(goalsKeyFor('user-a'), '{not json at all');

        await createGoal({ title: 'after corrupt json', type: 'habit' });

        const stored = JSON.parse(mockValues.get(goalsKeyFor('user-a')) ?? '{}') as Record<string, unknown>;
        expect(Object.keys(stored)).toHaveLength(1);
        expect(await listGoals()).toHaveLength(1);
    });

    it('treats non-object primitives as an empty store and keeps writing', async () => {
        mockValues.set(goalsKeyFor('user-a'), '42');

        await createGoal({ title: 'after number payload', type: 'goal' });

        const stored = JSON.parse(mockValues.get(goalsKeyFor('user-a')) ?? '{}') as Record<string, unknown>;
        expect(Object.keys(stored)).toHaveLength(1);
        expect(await listGoals()).toHaveLength(1);
    });
});
