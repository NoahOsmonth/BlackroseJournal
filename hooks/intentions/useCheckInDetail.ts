import { useCallback, useEffect, useState } from 'react';
import { getCheckIn } from '@/services/intentions/intentionsStorage';
import { IntentionCheckIn } from '@/services/intentions/intentionsStorage.types';

interface UseCheckInDetailReturn {
    checkIn: IntentionCheckIn | null;
    isLoading: boolean;
    refresh: () => Promise<void>;
}

export function useCheckInDetail(checkInId?: string): UseCheckInDetailReturn {
    const [checkIn, setCheckIn] = useState<IntentionCheckIn | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const refresh = useCallback(async () => {
        if (!checkInId) {
            setCheckIn(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        const loaded = await getCheckIn(checkInId);
        setCheckIn(loaded);
        setIsLoading(false);
    }, [checkInId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return {
        checkIn,
        isLoading,
        refresh,
    };
}
