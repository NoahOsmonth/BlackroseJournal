import {
    FINISH_BACKGROUND_STEPS,
    FinishBackgroundStatus,
    getFinishBackgroundStatus,
    subscribeFinishBackground,
} from '@/services/journal/finishBackgroundStore';
import { useEffect, useState } from 'react';

interface UseFinishBackgroundStatusReturn {
    status: FinishBackgroundStatus | null;
    isRunning: boolean;
    isDone: boolean;
}

/**
 * Subscribes to the in-memory finish-background store. Screens mount this to
 * show the "Updating memories…" banner and to refresh their data when the
 * background run settles.
 */
export function useFinishBackgroundStatus(): UseFinishBackgroundStatusReturn {
    const [status, setStatus] = useState<FinishBackgroundStatus | null>(
        () => getFinishBackgroundStatus(),
    );

    useEffect(() => {
        return subscribeFinishBackground(setStatus);
    }, []);

    const settledCount = status ? Object.keys(status.done).length : 0;
    const isRunning = status !== null && settledCount < FINISH_BACKGROUND_STEPS.length;
    const isDone = status !== null && settledCount >= FINISH_BACKGROUND_STEPS.length;

    return { status, isRunning, isDone };
}