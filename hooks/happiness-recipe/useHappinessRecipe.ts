/**
 * useHappinessRecipe Hook
 * Manages state and operations for Happiness Recipe items
 */

import { useCallback, useEffect, useState } from 'react';

import {
    addRecipeItem,
    deleteRecipeItem,
    loadRecipeItems,
    toggleRecipeItemCompletion,
    updateRecipeItem,
} from '@/services/happiness-recipe/happinessRecipeStorage';
import { RecipeItem, RecipeItemType } from '@/services/happiness-recipe/happinessRecipeStorage.types';

interface UseHappinessRecipeReturn {
    items: RecipeItem[];
    activeItems: RecipeItem[];
    completedItems: RecipeItem[];
    isLoading: boolean;
    addItem: (type: RecipeItemType, text: string) => Promise<RecipeItem | null>;
    updateItem: (id: string, text: string) => Promise<boolean>;
    toggleItem: (id: string) => Promise<boolean>;
    deleteItem: (id: string) => Promise<boolean>;
    refresh: () => Promise<void>;
}

export function useHappinessRecipe(): UseHappinessRecipeReturn {
    const [items, setItems] = useState<RecipeItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadItems = useCallback(async () => {
        const loaded = await loadRecipeItems();
        setItems(loaded);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        loadItems();
    }, [loadItems]);

    const activeItems = items.filter((item) => !item.completed);
    const completedItems = items
        .filter((item) => item.completed)
        .sort((a, b) => {
            // Sort by completedAt descending (most recent first)
            const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
            const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
            return bTime - aTime;
        });

    const addItem = useCallback(async (type: RecipeItemType, text: string) => {
        if (!text.trim()) return null;
        try {
            const newItem = await addRecipeItem(type, text.trim());
            setItems((prev) => (prev.some((i) => i.id === newItem.id) ? prev : [...prev, newItem]));
            return newItem;
        } catch {
            return null;
        }
    }, []);

    const updateItem = useCallback(async (id: string, text: string) => {
        if (!text.trim()) return false;
        try {
            const updated = await updateRecipeItem(id, { text: text.trim() });
            if (updated) {
                setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }, []);

    const toggleItem = useCallback(async (id: string) => {
        try {
            const updated = await toggleRecipeItemCompletion(id);
            if (updated) {
                setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }, []);

    const deleteItem = useCallback(async (id: string) => {
        try {
            const success = await deleteRecipeItem(id);
            if (success) {
                setItems((prev) => prev.filter((item) => item.id !== id));
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }, []);

    return {
        items,
        activeItems,
        completedItems,
        isLoading,
        addItem,
        updateItem,
        toggleItem,
        deleteItem,
        refresh: loadItems,
    };
}
