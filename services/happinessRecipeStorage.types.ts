/**
 * Happiness Recipe Storage Types
 */

export type RecipeItemType = 'ingredient' | 'goal';

export interface RecipeItem {
    id: string;
    type: RecipeItemType;
    text: string;
    completed: boolean;
    completedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface HappinessRecipeState {
    items: RecipeItem[];
}
