import { useMemo } from 'react';
import { useGoals } from './useGoals';
import { buildGoalsContext } from '@/services/goals/goalsPrompt';

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

    // No second subscription here on purpose (Kaneo #101). useGoals already
    // refreshes through useCollectionRefresh on the adapter's change bus, so a
    // goals write used to cost two listGoals() reads: one from that hook and one
    // from a duplicate subscriber in this wrapper.
    return { goalsContext, isLoading, refresh };
}
