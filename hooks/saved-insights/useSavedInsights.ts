import { useCallback, useEffect, useState } from 'react';
import {
    createSavedInsight,
    deleteSavedInsight,
    listSavedInsights,
} from '@/services/saved-insights/savedInsightsStorage';
import {
    SavedInsight,
    SavedInsightCreateInput,
} from '@/services/saved-insights/savedInsightsStorage.types';

interface UseSavedInsightsReturn {
    insights: SavedInsight[];
    isLoading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
    add: (input: SavedInsightCreateInput) => Promise<SavedInsight>;
    remove: (id: string) => Promise<boolean>;
}

export function useSavedInsights(): UseSavedInsightsReturn {
    const [insights, setInsights] = useState<SavedInsight[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const list = await listSavedInsights();
            setInsights(list);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load saved insights'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const add = useCallback(async (input: SavedInsightCreateInput) => {
        const insight = await createSavedInsight(input);
        await refresh();
        return insight;
    }, [refresh]);

    const remove = useCallback(async (id: string) => {
        const success = await deleteSavedInsight(id);
        await refresh();
        return success;
    }, [refresh]);

    return {
        insights,
        isLoading,
        error,
        refresh,
        add,
        remove,
    };
}
