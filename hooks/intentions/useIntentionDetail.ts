import { useCallback, useEffect, useState } from 'react';
import { getIntention, listCheckInsByIntention } from '@/services/intentions/intentionsStorage';
import { Intention, IntentionCheckIn } from '@/services/intentions/intentionsStorage.types';

interface UseIntentionDetailReturn {
    intention: Intention | null;
    latestCheckIn: IntentionCheckIn | null;
    isLoading: boolean;
    refresh: () => Promise<void>;
}

export function useIntentionDetail(intentionId?: string): UseIntentionDetailReturn {
    const [intention, setIntention] = useState<Intention | null>(null);
    const [latestCheckIn, setLatestCheckIn] = useState<IntentionCheckIn | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const refresh = useCallback(async () => {
        if (!intentionId) {
            setIntention(null);
            setLatestCheckIn(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        const loaded = await getIntention(intentionId);
        const checkIns = await listCheckInsByIntention(intentionId);
        const completed = checkIns.filter((item) => item.status === 'completed');
        setIntention(loaded);
        setLatestCheckIn(completed[0] ?? null);
        setIsLoading(false);
    }, [intentionId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return {
        intention,
        latestCheckIn,
        isLoading,
        refresh,
    };
}
