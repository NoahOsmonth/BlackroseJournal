import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    createIntention,
    listIntentions,
    updateIntention,
    archiveIntention,
    deleteIntention,
} from '@/services/intentions/intentionsStorage';
import { Intention, IntentionCreateInput, IntentionUpdateInput } from '@/services/intentions/intentionsStorage.types';
import { useActiveAccountId } from '@/hooks/account/useActiveAccountId';

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
    const accountId = useActiveAccountId();
    const [intentions, setIntentions] = useState<Intention[]>([]);
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
            const list = await listIntentions();
            setIntentions(list);
            hasLoadedRef.current = true;
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load intentions'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (accountId) {
            // A different account's rows must not be treated as already loaded.
            hasLoadedRef.current = false;
            void refresh();
        } else {
            setIntentions([]);
            hasLoadedRef.current = false;
            setIsLoading(false);
        }
    }, [accountId, refresh]);

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

    // Memoized: an inline filter returns a new array on every render, which
    // re-fires every downstream `useMemo` that depends on it.
    const activeIntentions = useMemo(
        () => intentions.filter((item) => !item.isArchived),
        [intentions]
    );

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
