import { useCallback, useEffect, useState } from 'react';
import {
    createIntention,
    listIntentions,
    updateIntention,
    archiveIntention,
    deleteIntention,
} from '@/services/intentions/intentionsStorage';
import { Intention, IntentionCreateInput, IntentionUpdateInput } from '@/services/intentions/intentionsStorage.types';

interface UseIntentionsReturn {
    intentions: Intention[];
    activeIntentions: Intention[];
    isLoading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
    create: (input: IntentionCreateInput) => Promise<Intention>;
    update: (id: string, updates: IntentionUpdateInput) => Promise<Intention | null>;
    archive: (id: string) => Promise<Intention | null>;
    remove: (id: string) => Promise<boolean>;
}

export function useIntentions(): UseIntentionsReturn {
    const [intentions, setIntentions] = useState<Intention[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const list = await listIntentions();
            setIntentions(list);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load intentions'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const create = useCallback(async (input: IntentionCreateInput) => {
        const intention = await createIntention(input);
        await refresh();
        return intention;
    }, [refresh]);

    const update = useCallback(async (id: string, updates: IntentionUpdateInput) => {
        const updated = await updateIntention(id, updates);
        await refresh();
        return updated;
    }, [refresh]);

    const archive = useCallback(async (id: string) => {
        const updated = await archiveIntention(id);
        await refresh();
        return updated;
    }, [refresh]);

    const remove = useCallback(async (id: string) => {
        const success = await deleteIntention(id);
        await refresh();
        return success;
    }, [refresh]);

    const activeIntentions = intentions.filter((item) => !item.isArchived);

    return {
        intentions,
        activeIntentions,
        isLoading,
        error,
        refresh,
        create,
        update,
        archive,
        remove,
    };
}
