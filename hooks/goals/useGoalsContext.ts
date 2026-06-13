import { useEffect, useMemo } from 'react';
import { useGoals } from './useGoals';
import { buildGoalsContext } from '@/services/goals/goalsPrompt';
import { subscribeGoalsChanges } from '@/services/goals/goalsStorage';

interface UseGoalsContextOptions {
    intentionId?: string;
}

interface UseGoalsContextReturn {
    goalsContext: string | undefined;
    isLoading: boolean;
    refresh: () => Promise<void>;
}

export function useGoalsContext(options: UseGoalsContextOptions = {}): UseGoalsContextReturn {
    const { goals, isLoading, refresh } = useGoals();

    const goalsContext = useMemo(() => {
        if (goals.length === 0) {
            return undefined;
        }
        return buildGoalsContext(goals, { intentionId: options.intentionId });
    }, [goals, options.intentionId]);

    useEffect(() => {
        return subscribeGoalsChanges(() => {
            refresh().catch(() => undefined);
        });
    }, [refresh]);

    return { goalsContext, isLoading, refresh };
}
