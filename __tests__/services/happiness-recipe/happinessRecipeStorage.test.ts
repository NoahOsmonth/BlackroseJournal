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


import { activateAccount, clearActiveAccount } from '../../../services/account/accountRuntime';
import {
    getAccountScopedStorageKeyForAccount,
    setAccountStorageAdapter,
} from '../../../services/account/accountScopedStorage';
import {
    addRecipeItem,
    clearAllRecipeItems,
    deleteRecipeItem,
    loadRecipeItems,
    toggleRecipeItemCompletion,
    updateRecipeItem,
} from '../../../services/happiness-recipe/happinessRecipeStorage';
import type { RecipeItem } from '../../../services/happiness-recipe/happinessRecipeStorage.types';

const STORAGE_KEY = '@happiness_recipe_items';

function adapter() {
    return {
        getItem: async (key: string) => mockValues.get(key) ?? null,
        setItem: async (key: string, value: string) => {
            mockValues.set(key, value);
        },
        removeItem: async (key: string) => {
            mockValues.delete(key);
        },
        getAllKeys: async () => Array.from(mockValues.keys()),
    };
}

function storedItemsFor(accountId: string): RecipeItem[] {
    const json = mockValues.get(getAccountScopedStorageKeyForAccount(STORAGE_KEY, accountId));
    if (!json) return [];
    return (JSON.parse(json) as { items: RecipeItem[] }).items;
}

describe('happiness recipe storage', () => {
    beforeEach(async () => {
        mockValues.clear();
        jest.clearAllMocks();
        setAccountStorageAdapter(adapter());
        await activateAccount('user-a');
    });

    afterEach(async () => {
        await clearActiveAccount();
    });

    it('adds and loads items for the active account', async () => {
        const item = await addRecipeItem('ingredient', 'Drink water');

        expect(item.type).toBe('ingredient');
        expect(item.text).toBe('Drink water');
        expect(item.completed).toBe(false);
        expect(await loadRecipeItems()).toEqual([item]);
    });

    it('dedupes habit items case- and whitespace-insensitively', async () => {
        const first = await addRecipeItem('habit', '  Meditate DAILY ');
        const second = await addRecipeItem('habit', 'meditate  daily');

        expect(second.id).toBe(first.id);
        expect(await loadRecipeItems()).toHaveLength(1);
    });

    it('allows duplicate non-habit items', async () => {
        await addRecipeItem('ingredient', 'Drink water');
        await addRecipeItem('ingredient', 'drink water');

        expect(await loadRecipeItems()).toHaveLength(2);
    });

    it('serializes concurrent additions so neither write is lost', async () => {
        await Promise.all([
            addRecipeItem('ingredient', 'Walk outside'),
            addRecipeItem('ingredient', 'Call a friend'),
        ]);

        const items = await loadRecipeItems();
        expect(items.map((item) => item.text).sort()).toEqual(['Call a friend', 'Walk outside']);
    });

    it('updates text', async () => {
        const item = await addRecipeItem('goal', 'Finish project');
        const updated = await updateRecipeItem(item.id, { text: 'Finish beta' });

        expect(updated?.text).toBe('Finish beta');
        expect(typeof updated?.updatedAt).toBe('string');
        expect((await loadRecipeItems())[0].text).toBe('Finish beta');
    });

    it('sets completedAt when completed and clears it when un-completed', async () => {
        const item = await addRecipeItem('habit', 'Read 10 pages');

        const completed = await updateRecipeItem(item.id, { completed: true });
        expect(completed?.completed).toBe(true);
        expect(completed?.completedAt).toBeDefined();

        const uncompleted = await updateRecipeItem(item.id, { completed: false });
        expect(uncompleted?.completed).toBe(false);
        expect(uncompleted?.completedAt).toBeUndefined();
    });

    it('toggles completion and returns null for unknown ids', async () => {
        const item = await addRecipeItem('habit', 'Stretch');

        const toggledOn = await toggleRecipeItemCompletion(item.id);
        expect(toggledOn?.completed).toBe(true);
        expect(toggledOn?.completedAt).toBeDefined();

        const toggledOff = await toggleRecipeItemCompletion(item.id);
        expect(toggledOff?.completed).toBe(false);
        expect(toggledOff?.completedAt).toBeUndefined();

        expect(await toggleRecipeItemCompletion('missing-id')).toBeNull();
    });

    it('deletes items and reports missing ids', async () => {
        const item = await addRecipeItem('ingredient', 'Sleep early');

        expect(await deleteRecipeItem(item.id)).toBe(true);
        expect(await loadRecipeItems()).toHaveLength(0);
        expect(await deleteRecipeItem(item.id)).toBe(false);
    });

    it('falls back to an empty list for unparseable or structurally corrupt payloads', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const scopedKey = getAccountScopedStorageKeyForAccount(STORAGE_KEY, 'user-a');
        const corruptPayloads = [
            '{not valid json',
            JSON.stringify({ items: {} }),
            JSON.stringify({ items: 'nope' }),
            JSON.stringify({ items: '' }),
            JSON.stringify({ items: 7 }),
            'null',
        ];

        for (const payload of corruptPayloads) {
            mockValues.set(scopedKey, payload);
            await expect(loadRecipeItems()).resolves.toEqual([]);
        }

        consoleSpy.mockRestore();
    });

    it('isolates items between accounts', async () => {
        await addRecipeItem('ingredient', 'Private item');

        await activateAccount('user-b');

        expect(await loadRecipeItems()).toEqual([]);
    });

    it('keeps items on disk across reloads', async () => {
        const item = await addRecipeItem('ingredient', 'Persisted item');

        expect(storedItemsFor('user-a')).toEqual([item]);
        expect(await loadRecipeItems()).toEqual([item]);
    });

    it('clears local items', async () => {
        await addRecipeItem('ingredient', 'Drink water');
        await clearAllRecipeItems();

        expect(await loadRecipeItems()).toEqual([]);
        expect(storedItemsFor('user-a')).toEqual([]);
    });
});
