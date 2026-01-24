/**
 * Goals and habits storage types
 */

export type GoalType = 'goal' | 'habit';

export interface GoalItem {
    id: string;
    title: string;
    type: GoalType;
    dateKey?: string;
    completed?: boolean;
    habitCompletions?: string[];
    intentionId?: string;
    createdAt: number;
    updatedAt: number;
}

export interface GoalCreateInput {
    title: string;
    type: GoalType;
    dateKey?: string;
    intentionId?: string;
}

export interface GoalUpdateInput {
    title?: string;
    dateKey?: string;
    completed?: boolean;
    habitCompletions?: string[];
    intentionId?: string;
}
