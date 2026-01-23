/**
 * Happiness Recipe Storage Service
 * Handles persistence for recipe ingredients and goals
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { HappinessRecipeState, RecipeItem, RecipeItemType } from './happinessRecipeStorage.types';
import {
    loadRemoteRecipeItems,
    queueRecipeItemDelete,
    queueRecipeItemUpsert,
} from './happinessRecipeRemote';

const STORAGE_KEY = '@happiness_recipe_items';
let hasSeededRemote = false;

async function seedRemoteItems(items: RecipeItem[]): Promise<void> {
    if (hasSeededRemote || items.length === 0) {
        return;
    }

    try {
        await Promise.all(items.map((item) => queueRecipeItemUpsert(item)));
        hasSeededRemote = true;
    } catch (error) {
        console.error('Failed to seed remote recipe items:', error);
    }
}

/**
 * Load all recipe items from storage
 */
export async function loadRecipeItems(): Promise<RecipeItem[]> {
    try {
        const json = await AsyncStorage.getItem(STORAGE_KEY);
        if (json) {
            const state: HappinessRecipeState = JSON.parse(json);
            const items = state.items || [];
            await seedRemoteItems(items);
            return items;
        }
        const remoteItems = await loadRemoteRecipeItems();
        if (remoteItems) {
            await saveRecipeItems(remoteItems);
            return remoteItems;
        }
        return [];
    } catch (error) {
        console.error('Failed to load recipe items:', error);
        return [];
    }
}

/**
 * Save all recipe items to storage
 */
async function saveRecipeItems(items: RecipeItem[]): Promise<void> {
    try {
        const state: HappinessRecipeState = { items };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
export async function addRecipeItem(
    type: RecipeItemType,
    text: string
): Promise<RecipeItem> {
    const items = await loadRecipeItems();
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
    await saveRecipeItems(items);
    try {
        await queueRecipeItemUpsert(newItem);
    } catch (error) {
        console.error('Failed to queue recipe item sync:', error);
    }
    return newItem;
}

/**
 * Update a recipe item
 */
export async function updateRecipeItem(
    id: string,
    updates: Partial<Pick<RecipeItem, 'text' | 'completed'>>
): Promise<RecipeItem | null> {
    const items = await loadRecipeItems();
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
    await saveRecipeItems(items);
    try {
        await queueRecipeItemUpsert(updatedItem);
    } catch (error) {
        console.error('Failed to queue recipe item sync:', error);
    }
    return updatedItem;
}

/**
 * Delete a recipe item
 */
export async function deleteRecipeItem(id: string): Promise<boolean> {
    const items = await loadRecipeItems();
    const filteredItems = items.filter((item) => item.id !== id);

    if (filteredItems.length === items.length) {
        return false; // Item not found
    }

    await saveRecipeItems(filteredItems);
    try {
        await queueRecipeItemDelete(id);
    } catch (error) {
        console.error('Failed to queue recipe item delete:', error);
    }
    return true;
}

/**
 * Toggle completion status of a recipe item
 */
export async function toggleRecipeItemCompletion(id: string): Promise<RecipeItem | null> {
    const items = await loadRecipeItems();
    const item = items.find((i) => i.id === id);

    if (!item) {
        return null;
    }

    return updateRecipeItem(id, { completed: !item.completed });
}

/**
 * Clear all recipe items (for testing/reset)
 */
export async function clearAllRecipeItems(): Promise<void> {
    const items = await loadRecipeItems();
    await Promise.all(items.map(async (item) => {
        try {
            await queueRecipeItemDelete(item.id);
        } catch (error) {
            console.error('Failed to queue recipe item delete:', error);
        }
    }));
    await AsyncStorage.removeItem(STORAGE_KEY);
}
