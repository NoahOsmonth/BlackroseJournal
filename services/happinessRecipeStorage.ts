/**
 * Happiness Recipe Storage Service
 * Handles persistence for recipe ingredients and goals
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { HappinessRecipeState, RecipeItem, RecipeItemType } from './happinessRecipeStorage.types';

const STORAGE_KEY = '@happiness_recipe_items';

/**
 * Load all recipe items from storage
 */
export async function loadRecipeItems(): Promise<RecipeItem[]> {
    try {
        const json = await AsyncStorage.getItem(STORAGE_KEY);
        if (json) {
            const state: HappinessRecipeState = JSON.parse(json);
            return state.items || [];
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

/**
 * Add a new recipe item
 */
export async function addRecipeItem(
    type: RecipeItemType,
    text: string
): Promise<RecipeItem> {
    const items = await loadRecipeItems();
    const now = new Date().toISOString();

    const newItem: RecipeItem = {
        id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        type,
        text,
        completed: false,
        createdAt: now,
        updatedAt: now,
    };

    items.push(newItem);
    await saveRecipeItems(items);
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
    await AsyncStorage.removeItem(STORAGE_KEY);
}
