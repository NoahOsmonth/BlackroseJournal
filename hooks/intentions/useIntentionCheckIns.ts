import { useCallback, useEffect, useRef, useState } from 'react';
import {
    createCheckIn,
    deleteCheckIn,
    listCheckIns,
    updateCheckIn,
} from '@/services/intentions/intentionsStorage';
import {
    IntentionCheckIn,
    IntentionCheckInCreateInput,
    IntentionCheckInUpdateInput,
} from '@/services/intentions/intentionsStorage.types';
import { useActiveAccountId } from '@/hooks/account/useActiveAccountId';
import { useCollectionRefresh } from '@/hooks/collections/useCollectionRefresh';

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

const CHECK_IN_KEYS = ['@intention_checkins'];

export function useIntentionCheckIns(): UseIntentionCheckInsReturn {
    const accountId = useActiveAccountId();
    const [checkIns, setCheckIns] = useState<IntentionCheckIn[]>([]);
    const [completed, setCompleted] = useState<IntentionCheckIn[]>([]);
    const [drafts, setDrafts] = useState<IntentionCheckIn[]>([]);
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
            // `listCompletedCheckIns` and `listCheckInDrafts` each call
            // `listCheckIns` again, so the previous three-way fetch parsed the
            // same key three times. Split one read instead.
            const all = await listCheckIns();
            setCheckIns(all);
            setCompleted(all.filter((item) => item.status === 'completed'));
            setDrafts(all.filter((item) => item.status === 'draft'));
            hasLoadedRef.current = true;
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load check-ins'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useCollectionRefresh(CHECK_IN_KEYS, refresh);

    useEffect(() => {
        if (accountId) {
            // A different account's rows must not be treated as already loaded.
            hasLoadedRef.current = false;
            void refresh();
        } else {
            setCheckIns([]);
            setCompleted([]);
            setDrafts([]);
            hasLoadedRef.current = false;
            setIsLoading(false);
        }
    }, [accountId, refresh]);

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
