/**
 * Happiness Recipe Storage Service
 * Handles persistence for recipe ingredients and goals
 */

import { AccountStorageAdapter, getStorageForAccount } from '@/services/account/accountScopedStorage';
import {
    AccountOperationContext,
    assertAccountOperationActive,
    registerAccountTeardown,
    runAccountBoundOperation,
} from '@/services/account/accountRuntime';

import { HappinessRecipeState, RecipeItem, RecipeItemType } from './happinessRecipeStorage.types';
import {
    loadRemoteRecipeItems,
    queueRecipeItemDelete,
    queueRecipeItemUpsert,
} from './happinessRecipeRemote';

const STORAGE_KEY = '@happiness_recipe_items';
let hasSeededRemote = false;
let mutationQueue: Promise<void> = Promise.resolve();

registerAccountTeardown(() => {
    hasSeededRemote = false;
    mutationQueue = Promise.resolve();
});

function enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationQueue.then(operation, operation);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
}

async function seedRemoteItems(
    items: RecipeItem[],
    context: AccountOperationContext,
): Promise<void> {
    if (hasSeededRemote || items.length === 0) {
        return;
    }

    try {
        await Promise.all(items.map((item) => queueRecipeItemUpsert(item)));
        assertAccountOperationActive(context);
        hasSeededRemote = true;
    } catch (error) {
        if (context.signal.aborted) throw error;
        console.error('Failed to seed remote recipe items:', error);
    }
}

/**
 * Load all recipe items from storage
 */
async function loadRecipeItemsForAccount(
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
): Promise<RecipeItem[]> {
    try {
        const json = await storage.getItem(STORAGE_KEY);
        assertAccountOperationActive(context);
        if (json) {
            let state: HappinessRecipeState;
            try {
                state = JSON.parse(json) as HappinessRecipeState;
            } catch {
                state = { items: [] };
            }
            const items = state.items || [];
            await seedRemoteItems(items, context);
            return items;
        }
        const remoteItems = await loadRemoteRecipeItems();
        assertAccountOperationActive(context);
        if (remoteItems) {
            await saveRecipeItems(storage, remoteItems);
            assertAccountOperationActive(context);
            return remoteItems;
        }
        return [];
    } catch (error) {
        assertAccountOperationActive(context);
        console.error('Failed to load recipe items:', error);
        return [];
    }
}

export function loadRecipeItems(): Promise<RecipeItem[]> {
    return runAccountBoundOperation('happiness-recipe-load', (context) => (
        loadRecipeItemsForAccount(getStorageForAccount(context.accountId), context)
    ));
}

/**
 * Save all recipe items to storage
 */
async function saveRecipeItems(
    storage: AccountStorageAdapter,
    items: RecipeItem[],
): Promise<void> {
    try {
        const state: HappinessRecipeState = { items };
        await storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
        console.error('Failed to save recipe items:', error);
        throw error;
    }
}

function normalizeRecipeText(text: string): string {
    return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Add a new recipe item
 */
async function addRecipeItemForAccount(
    type: RecipeItemType,
    text: string,
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
): Promise<RecipeItem> {
    const items = await loadRecipeItemsForAccount(storage, context);
    assertAccountOperationActive(context);
    const now = new Date().toISOString();

    const trimmed = text.trim();

    // Dedupe HABIT items (case-insensitive) to avoid repeated additions from suggestions
    if (type === 'habit') {
        const normalized = normalizeRecipeText(trimmed);
        const existing = items.find(
            (item) => item.type === 'habit' && normalizeRecipeText(item.text) === normalized
        );
        if (existing) {
            return existing;
        }
    }

    const newItem: RecipeItem = {
        id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        type,
        text: trimmed,
        completed: false,
        createdAt: now,
        updatedAt: now,
    };

    items.push(newItem);
    await saveRecipeItems(storage, items);
    assertAccountOperationActive(context);
    try {
        await queueRecipeItemUpsert(newItem);
        assertAccountOperationActive(context);
    } catch (error) {
        if (context.signal.aborted) throw error;
        console.error('Failed to queue recipe item sync:', error);
    }
    return newItem;
}

export function addRecipeItem(type: RecipeItemType, text: string): Promise<RecipeItem> {
    return runAccountBoundOperation('happiness-recipe-add', (context) => enqueueMutation(() => (
        addRecipeItemForAccount(type, text, getStorageForAccount(context.accountId), context)
    )));
}

/**
 * Update a recipe item
 */
async function updateRecipeItemForAccount(
    id: string,
    updates: Partial<Pick<RecipeItem, 'text' | 'completed'>>,
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
): Promise<RecipeItem | null> {
    const items = await loadRecipeItemsForAccount(storage, context);
    assertAccountOperationActive(context);
    const index = items.findIndex((item) => item.id === id);

    if (index === -1) {
        return null;
    }

    const now = new Date().toISOString();
    const updatedItem: RecipeItem = {
        ...items[index],
        ...updates,
        updatedAt: now,
    };

    // Set completedAt when marking as completed
    if (updates.completed === true && !items[index].completed) {
        updatedItem.completedAt = now;
    } else if (updates.completed === false) {
        updatedItem.completedAt = undefined;
    }

    items[index] = updatedItem;
    await saveRecipeItems(storage, items);
    assertAccountOperationActive(context);
    try {
        await queueRecipeItemUpsert(updatedItem);
        assertAccountOperationActive(context);
    } catch (error) {
        if (context.signal.aborted) throw error;
        console.error('Failed to queue recipe item sync:', error);
    }
    return updatedItem;
}

export function updateRecipeItem(
    id: string,
    updates: Partial<Pick<RecipeItem, 'text' | 'completed'>>,
): Promise<RecipeItem | null> {
    return runAccountBoundOperation('happiness-recipe-update', (context) => enqueueMutation(() => (
        updateRecipeItemForAccount(
            id,
            updates,
            getStorageForAccount(context.accountId),
            context,
        )
    )));
}

/**
 * Delete a recipe item
 */
async function deleteRecipeItemForAccount(
    id: string,
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
): Promise<boolean> {
    const items = await loadRecipeItemsForAccount(storage, context);
    assertAccountOperationActive(context);
    const filteredItems = items.filter((item) => item.id !== id);

    if (filteredItems.length === items.length) {
        return false; // Item not found
    }

    await saveRecipeItems(storage, filteredItems);
    assertAccountOperationActive(context);
    try {
        await queueRecipeItemDelete(id);
        assertAccountOperationActive(context);
    } catch (error) {
        if (context.signal.aborted) throw error;
        console.error('Failed to queue recipe item delete:', error);
    }
    return true;
}

export function deleteRecipeItem(id: string): Promise<boolean> {
    return runAccountBoundOperation('happiness-recipe-delete', (context) => enqueueMutation(() => (
        deleteRecipeItemForAccount(id, getStorageForAccount(context.accountId), context)
    )));
}

/**
 * Toggle completion status of a recipe item
 */
export function toggleRecipeItemCompletion(id: string): Promise<RecipeItem | null> {
    return runAccountBoundOperation('happiness-recipe-toggle', (context) => enqueueMutation(async () => {
    const storage = getStorageForAccount(context.accountId);
    const items = await loadRecipeItemsForAccount(storage, context);
    assertAccountOperationActive(context);
    const item = items.find((i) => i.id === id);

    if (!item) {
        return null;
    }

    return updateRecipeItemForAccount(id, { completed: !item.completed }, storage, context);
    }));
}

/**
 * Clear all recipe items (for testing/reset)
 */
export function clearAllRecipeItems(): Promise<void> {
    return runAccountBoundOperation('happiness-recipe-clear', (context) => enqueueMutation(async () => {
    const storage = getStorageForAccount(context.accountId);
    const items = await loadRecipeItemsForAccount(storage, context);
    assertAccountOperationActive(context);
    await Promise.all(items.map(async (item) => {
        try {
            await queueRecipeItemDelete(item.id);
        } catch (error) {
            console.error('Failed to queue recipe item delete:', error);
        }
    }));
    assertAccountOperationActive(context);
    await storage.removeItem(STORAGE_KEY);
    assertAccountOperationActive(context);
    }));
}
