/**
 * Saved insights storage types
 */

export interface SavedInsight {
    id: string;
    question: string;
    sourceDate?: string;
    createdAt: number;
    updatedAt: number;
}

export interface SavedInsightCreateInput {
    question: string;
    sourceDate?: string;
}

export interface SavedInsightUpdateInput {
    question?: string;
    sourceDate?: string;
}
