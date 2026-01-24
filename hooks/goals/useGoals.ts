import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    createGoal,
    deleteGoal,
    listGoals,
    toggleGoalCompletion,
    updateGoal,
} from '@/services/goals/goalsStorage';
import { GoalCreateInput, GoalItem, GoalUpdateInput } from '@/services/goals/goalsStorage.types';

interface UseGoalsReturn {
    goals: GoalItem[];
    isLoading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
    create: (input: GoalCreateInput) => Promise<GoalItem>;
    update: (id: string, updates: GoalUpdateInput) => Promise<GoalItem | null>;
    remove: (id: string) => Promise<boolean>;
    toggle: (id: string, dateKey?: string) => Promise<GoalItem | null>;
    habits: GoalItem[];
}

export function useGoals(): UseGoalsReturn {
    const [goals, setGoals] = useState<GoalItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const list = await listGoals();
            setGoals(list);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load goals'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const create = useCallback(async (input: GoalCreateInput) => {
        const goal = await createGoal(input);
        await refresh();
        return goal;
    }, [refresh]);

    const update = useCallback(async (id: string, updates: GoalUpdateInput) => {
        const updated = await updateGoal(id, updates);
        await refresh();
        return updated;
    }, [refresh]);

    const remove = useCallback(async (id: string) => {
        const success = await deleteGoal(id);
        await refresh();
        return success;
    }, [refresh]);

    const toggle = useCallback(async (id: string, dateKey?: string) => {
        const updated = await toggleGoalCompletion(id, dateKey);
        await refresh();
        return updated;
    }, [refresh]);

    const habits = useMemo(
        () => goals.filter((goal) => goal.type === 'habit'),
        [goals]
    );

    return {
        goals,
        habits,
        isLoading,
        error,
        refresh,
        create,
        update,
        remove,
        toggle,
    };
}
