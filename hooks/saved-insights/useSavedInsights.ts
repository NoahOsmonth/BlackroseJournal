import { useCallback, useEffect, useRef, useState } from 'react';
import { useActiveAccountId } from '@/hooks/account/useActiveAccountId';
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
    const accountId = useActiveAccountId();
    const [insights, setInsights] = useState<SavedInsight[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const hasLoadedRef = useRef(false);

    const refresh = useCallback(async () => {
        // Only the first load shows a spinner — see useJournalEntries.
        if (!hasLoadedRef.current) {
            setIsLoading(true);
        }
        setError(null);
        try {
            const list = await listSavedInsights();
            setInsights(list);
            hasLoadedRef.current = true;
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load saved insights'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (accountId) {
            // A different account's insights must not be treated as already
            // loaded, and must not stay on screen while the new account's read
            // is in flight — so drop them before refreshing.
            hasLoadedRef.current = false;
            setInsights([]);
            void refresh();
        } else {
            setInsights([]);
            hasLoadedRef.current = false;
            setIsLoading(false);
        }
    }, [accountId, refresh]);

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
