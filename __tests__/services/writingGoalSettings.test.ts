/**
 * Writing-goal setting storage: safe parse, serialized writes, account scoping,
 * and the schemaVersion envelope (AGENTS.md rule 4).
 */
import {
    getWritingGoalSettings,
    setWritingGoalSettings,
    clearWritingGoalSettings,
    subscribeWritingGoal,
    WRITING_GOAL_KEY,
} from '../../services/goals/writingGoalSettings';
import { DEFAULT_WRITING_GOAL } from '../../utils/writingGoal';

const mockGetStorageForAccount = jest.fn();
jest.mock('@/services/account/accountScopedStorage', () => ({
    getStorageForAccount: (accountId: string) => mockGetStorageForAccount(accountId),
}));

jest.mock('@/services/account/accountRuntime', () => ({
    assertAccountOperationActive: () => undefined,
    registerAccountTeardown: () => undefined,
    runAccountBoundOperation: (_name: string, operation: (context: { accountId: string }) => unknown) =>
        operation({ accountId: 'acct-test' }),
}));

/** Minimal in-file adapter — no AsyncStorage dynamic import in Jest. */
const values = new Map<string, string>();
const storage = {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
    removeItem: async (key: string) => { values.delete(key); },
};

beforeEach(() => {
    values.clear();
    mockGetStorageForAccount.mockReturnValue(storage);
});

describe('writingGoalSettings storage', () => {
    it('starts with the calm default', async () => {
        expect(await getWritingGoalSettings()).toEqual(DEFAULT_WRITING_GOAL);
    });

    it('writes a schemaVersion envelope to its own key', async () => {
        await setWritingGoalSettings({ wordsPerDay: 250 });
        const raw = await storage.getItem(WRITING_GOAL_KEY);
        expect(raw).not.toBeNull();
        const payload = JSON.parse(raw as string);
        expect(payload.schemaVersion).toBe(1);
        expect(payload.wordsPerDay).toBe(250);
        expect(payload.restDaysPerWeek).toBe(DEFAULT_WRITING_GOAL.restDaysPerWeek);
        expect(typeof payload.updatedAt).toBe('number');
    });

    it('keeps the other preset when only one changes', async () => {
        await setWritingGoalSettings({ restDaysPerWeek: 3 });
        await setWritingGoalSettings({ wordsPerDay: 500 });
        expect(await getWritingGoalSettings()).toEqual({ wordsPerDay: 500, restDaysPerWeek: 3 });
    });

    it('clamps unsupported values to presets', async () => {
        const saved = await setWritingGoalSettings({ wordsPerDay: 999, restDaysPerWeek: -1 });
        expect(saved).toEqual(DEFAULT_WRITING_GOAL);
    });

    it('survives a corrupt payload instead of throwing', async () => {
        await storage.setItem(WRITING_GOAL_KEY, '{not json');
        expect(await getWritingGoalSettings()).toEqual(DEFAULT_WRITING_GOAL);
    });

    it('survives an array or null payload', async () => {
        await storage.setItem(WRITING_GOAL_KEY, '[1,2,3]');
        expect(await getWritingGoalSettings()).toEqual(DEFAULT_WRITING_GOAL);
        await storage.setItem(WRITING_GOAL_KEY, 'null');
        expect(await getWritingGoalSettings()).toEqual(DEFAULT_WRITING_GOAL);
    });

    it('serializes overlapping writes so neither is lost', async () => {
        const [a, b] = await Promise.all([
            setWritingGoalSettings({ wordsPerDay: 50 }),
            setWritingGoalSettings({ restDaysPerWeek: 1 }),
        ]);
        expect(a.wordsPerDay).toBe(50);
        expect(b.restDaysPerWeek).toBe(1);
        expect(await getWritingGoalSettings()).toEqual({ wordsPerDay: 50, restDaysPerWeek: 1 });
    });

    it('notifies subscribers on a write and on clear', async () => {
        const seen: number[] = [];
        const stop = subscribeWritingGoal((s) => seen.push(s.wordsPerDay));
        await setWritingGoalSettings({ wordsPerDay: 750 });
        await clearWritingGoalSettings();
        stop();
        expect(seen).toEqual([750, DEFAULT_WRITING_GOAL.wordsPerDay]);
    });

    it('clear writes a default envelope, not removeItem', async () => {
        await setWritingGoalSettings({ wordsPerDay: 750, restDaysPerWeek: 3 });
        await clearWritingGoalSettings();
        const raw = await storage.getItem(WRITING_GOAL_KEY);
        expect(raw).not.toBeNull();
        const payload = JSON.parse(raw as string);
        expect(payload.schemaVersion).toBe(1);
        expect(await getWritingGoalSettings()).toEqual(DEFAULT_WRITING_GOAL);
    });
});
