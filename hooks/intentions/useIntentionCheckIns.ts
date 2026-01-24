import { useCallback, useEffect, useState } from 'react';
import {
    createCheckIn,
    deleteCheckIn,
    listCheckIns,
    listCheckInDrafts,
    listCompletedCheckIns,
    updateCheckIn,
} from '@/services/intentions/intentionsStorage';
import {
    IntentionCheckIn,
    IntentionCheckInCreateInput,
    IntentionCheckInUpdateInput,
} from '@/services/intentions/intentionsStorage.types';

interface UseIntentionCheckInsReturn {
    checkIns: IntentionCheckIn[];
    completed: IntentionCheckIn[];
    drafts: IntentionCheckIn[];
    isLoading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
    create: (input: IntentionCheckInCreateInput) => Promise<IntentionCheckIn>;
    update: (id: string, updates: IntentionCheckInUpdateInput) => Promise<IntentionCheckIn | null>;
    remove: (id: string) => Promise<boolean>;
}

export function useIntentionCheckIns(): UseIntentionCheckInsReturn {
    const [checkIns, setCheckIns] = useState<IntentionCheckIn[]>([]);
    const [completed, setCompleted] = useState<IntentionCheckIn[]>([]);
    const [drafts, setDrafts] = useState<IntentionCheckIn[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [all, completedItems, draftItems] = await Promise.all([
                listCheckIns(),
                listCompletedCheckIns(),
                listCheckInDrafts(),
            ]);
            setCheckIns(all);
            setCompleted(completedItems);
            setDrafts(draftItems);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load check-ins'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const create = useCallback(async (input: IntentionCheckInCreateInput) => {
        const checkIn = await createCheckIn(input);
        await refresh();
        return checkIn;
    }, [refresh]);

    const update = useCallback(async (id: string, updates: IntentionCheckInUpdateInput) => {
        const updated = await updateCheckIn(id, updates);
        await refresh();
        return updated;
    }, [refresh]);

    const remove = useCallback(async (id: string) => {
        const success = await deleteCheckIn(id);
        await refresh();
        return success;
    }, [refresh]);

    return {
        checkIns,
        completed,
        drafts,
        isLoading,
        error,
        refresh,
        create,
        update,
        remove,
    };
}
