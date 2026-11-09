import { getStorageForAccount, setAccountStorageAdapter } from '../../services/account/accountScopedStorage';
import type { AccountStorageAdapter } from '../../services/account/accountScopedStorage';
import { activateAccount, clearActiveAccount } from '../../services/account/accountRuntime';
import {
    DAY_MOODS_KEY,
    clearAllDayMoods,
    clearDayMood,
    listDayMoods,
    readDayMood,
    setDayMoodFeeling,
    subscribeDayMoods,
    toggleDayFactor,
} from '@/services/journal/dayMood';
import { MAX_DAY_FACTORS } from '@/utils/dayMood';

const DAY = '2026-11-09';

function memoryAdapter() {
    const rows = new Map<string, string>();
    const adapter: AccountStorageAdapter = {
        getItem: (k) => Promise.resolve(rows.get(k) ?? null),
        setItem: (k, v) => { rows.set(k, v); return Promise.resolve(); },
        removeItem: (k) => { rows.delete(k); return Promise.resolve(); },
    };
    return { rows, adapter };
}

let store: ReturnType<typeof memoryAdapter>;

beforeEach(async () => {
    await clearActiveAccount();
    store = memoryAdapter();
    setAccountStorageAdapter(store.adapter);
    await activateAccount('mood-account');
});

afterEach(async () => { await clearActiveAccount(); });

describe('day mood store', () => {
    it('starts empty', async () => {
        expect(await listDayMoods()).toEqual({});
        expect(await readDayMood(DAY)).toBeNull();
    });

    it('records a feeling for one day only', async () => {
        await setDayMoodFeeling(DAY, 'light');
        expect(await readDayMood(DAY)).toMatchObject({ moodId: 'light', factorIds: [] });
        expect(await readDayMood('2026-11-08')).toBeNull();
    });

    it('ignores a feeling it does not offer', async () => {
        await setDayMoodFeeling(DAY, 'ecstatic');
        expect(await readDayMood(DAY)).toBeNull();
    });

    it('toggles a cause on and off', async () => {
        await setDayMoodFeeling(DAY, 'mixed');
        await toggleDayFactor(DAY, 'work');
        expect((await readDayMood(DAY))?.factorIds).toEqual(['work']);
        await toggleDayFactor(DAY, 'work');
        expect((await readDayMood(DAY))?.factorIds).toEqual([]);
    });

    it('keeps causes in the offered order, not the tap order', async () => {
        await setDayMoodFeeling(DAY, 'heavy');
        await toggleDayFactor(DAY, 'weather');
        await toggleDayFactor(DAY, 'people');
        expect((await readDayMood(DAY))?.factorIds).toEqual(['people', 'weather']);
    });

    it('refuses a seventh cause instead of dropping one', async () => {
        await setDayMoodFeeling(DAY, 'light');
        const all = ['people', 'work', 'rest', 'sleep', 'health', 'movement', 'money'];
        for (const id of all) await toggleDayFactor(DAY, id);
        const entry = await readDayMood(DAY);
        expect(entry?.factorIds).toHaveLength(MAX_DAY_FACTORS);
        expect(entry?.factorIds).not.toContain('money');
    });

    it('drops the day when both the feeling and the causes go', async () => {
        await setDayMoodFeeling(DAY, 'calm');
        await toggleDayFactor(DAY, 'rest');
        await setDayMoodFeeling(DAY, null);
        expect((await readDayMood(DAY))?.moodId).toBeNull();
        await toggleDayFactor(DAY, 'rest');
        expect(await readDayMood(DAY)).toBeNull();
    });

    it('refuses a date key that is not a calendar day', async () => {
        await setDayMoodFeeling('not-a-day', 'light');
        expect(await listDayMoods()).toEqual({});
    });

    it('survives a corrupt payload without throwing', async () => {
        // Written through the account-scoped adapter, or the read misses and this
        // passes for the wrong reason (it did, first time).
        await getStorageForAccount('mood-account').setItem(DAY_MOODS_KEY, '{not json');
        expect(store.rows.size).toBeGreaterThan(0);
        expect(await listDayMoods()).toEqual({});
    });

    it('drops unknown ids and bad keys when loading a hand-written payload', async () => {
        await getStorageForAccount('mood-account').setItem(DAY_MOODS_KEY, JSON.stringify({
            schemaVersion: 1,
            days: {
                [DAY]: { moodId: 'light', factorIds: ['work', 'nonsense'], updatedAt: 1 },
                'nope': { moodId: 'calm', factorIds: [], updatedAt: 1 },
                '2026-11-07': { moodId: 'unknown', factorIds: [], updatedAt: 1 },
            },
            updatedAt: 1,
        }));
        const days = await listDayMoods();
        expect(days[DAY].factorIds).toEqual(['work']);
        expect(days.nope).toBeUndefined();
        expect(days['2026-11-07']).toBeUndefined();
    });

    it('serializes concurrent writes instead of losing one', async () => {
        await Promise.all([
            setDayMoodFeeling(DAY, 'light'),
            toggleDayFactor(DAY, 'people'),
            toggleDayFactor(DAY, 'rest'),
        ]);
        const entry = await readDayMood(DAY);
        expect(entry?.moodId).toBe('light');
        expect(entry?.factorIds).toEqual(['people', 'rest']);
    });

    it('notifies subscribers and stops after unsubscribe', async () => {
        const seen: string[][] = [];
        const unsubscribe = subscribeDayMoods((days) => seen.push(Object.keys(days)));
        await setDayMoodFeeling(DAY, 'calm');
        unsubscribe();
        await setDayMoodFeeling(DAY, 'light');
        expect(seen).toHaveLength(1);
        expect(seen[0]).toEqual([DAY]);
    });

    it('clearDayMood removes one day and clearAll empties the store', async () => {
        await setDayMoodFeeling(DAY, 'light');
        await setDayMoodFeeling('2026-11-08', 'heavy');
        await clearDayMood(DAY);
        expect(await readDayMood(DAY)).toBeNull();
        expect(await readDayMood('2026-11-08')).not.toBeNull();
        await clearAllDayMoods();
        expect(await listDayMoods()).toEqual({});
    });
});
