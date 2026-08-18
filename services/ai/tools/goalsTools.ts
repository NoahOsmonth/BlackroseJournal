/**
 * On-device goals tools: list goals/habits and create them.
 * Act only on explicit goal/habit requests — never invent one.
 */

import { createGoal, listGoals } from '@/services/goals/goalsStorage';
import type { GoalItem, GoalType } from '@/services/goals/goalsStorage.types';
import { getLocalDateKey } from '@/utils/date';
import type { ToolHandler } from './types';

function asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function formatGoal(goal: GoalItem): string {
    const dateKey = goal.dateKey ?? 'none';
    const completed =
        goal.type === 'habit'
            ? (goal.habitCompletions ?? []).length > 0
            : Boolean(goal.completed);
    return `- [${goal.type}] ${goal.title} (date: ${dateKey}, completed: ${completed ? 'yes' : 'no'})`;
}

/** List current goals and habits with status. */
export const listGoalsTool: ToolHandler = async () => {
    const goals = await listGoals();
    if (goals.length === 0) {
        return 'No goals yet. The user can create goals in the Goals screen or ask you to set one.';
    }
    return goals.map(formatGoal).join('\n');
};

/**
 * Create a goal or habit. Only called when the user clearly asked to
 * set/track one — the title must come from the user, never invented.
 */
export const createGoalTool: ToolHandler = async (args) => {
    const title = asString(args.title);
    if (!title) {
        return 'Error: title is required.';
    }
    const type: GoalType = args.type === 'habit' ? 'habit' : 'goal';
    const dateKey = asString(args.dateKey) ?? getLocalDateKey(new Date());
    const goal = await createGoal({ title, type, dateKey });
    return `Created ${type} "${goal.title}" (date: ${dateKey}). id: ${goal.id}`;
};
