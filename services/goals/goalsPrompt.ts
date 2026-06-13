/**
 * Goals prompt formatter
 *
 * Turns the user's active goals/habits into a compact markdown block suitable
 * for injection into AI prompts. Keeps formatting, capping, and streak logic
 * in one testable service so every AI surface sees the same shape.
 */

import type { GoalItem } from './goalsStorage.types';
import { getLocalDateKey } from '@/utils/date';

export interface BuildGoalsContextOptions {
    /** Today's date key in YYYY-MM-DD form; defaults to the current local day. */
    todayDateKey?: string;
    /** When provided, goals linked to this intention are listed first. */
    intentionId?: string;
    /** Hard character cap for the produced block. */
    maxChars?: number;
    /** Maximum active goals to include. */
    maxGoals?: number;
    /** Maximum habits to include. */
    maxHabits?: number;
}

const DEFAULT_MAX_CHARS = 1500;
const DEFAULT_MAX_GOALS = 10;
const DEFAULT_MAX_HABITS = 10;

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function toTodayDateKey(options?: BuildGoalsContextOptions): string {
    return options?.todayDateKey ?? getLocalDateKey(new Date());
}

function isActiveGoal(item: GoalItem): boolean {
    return item.type === 'goal' && item.completed !== true;
}

function sortByUpdatedAtDesc(a: GoalItem, b: GoalItem): number {
    return b.updatedAt - a.updatedAt;
}

function prioritizeIntentionId(
    items: GoalItem[],
    intentionId: string | undefined
): GoalItem[] {
    return [...items].sort((a, b) => {
        if (intentionId) {
            const aLinked = a.intentionId === intentionId ? 1 : 0;
            const bLinked = b.intentionId === intentionId ? 1 : 0;
            if (aLinked !== bLinked) {
                return bLinked - aLinked;
            }
        }
        return sortByUpdatedAtDesc(a, b);
    });
}

export function formatGoalItem(goal: GoalItem): string {
    return `- ${goal.title} (Goal)`;
}

function dateKeyToNoonDate(dateKey: string): Date {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0);
}

function calculateCurrentStreak(
    completions: string[],
    todayDateKey: string
): number {
    const keys = new Set(completions);
    const cursor = dateKeyToNoonDate(todayDateKey);
    let streak = 0;

    while (keys.has(getLocalDateKey(cursor))) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
}

function buildSevenDayIndicator(
    completions: string[],
    todayDateKey: string
): string {
    const keys = new Set(completions);
    const today = dateKeyToNoonDate(todayDateKey);
    const cells: string[] = [];

    for (let offset = -6; offset <= 0; offset += 1) {
        const cursor = new Date(today);
        cursor.setDate(cursor.getDate() + offset);
        const key = getLocalDateKey(cursor);
        const dayLetter = DAY_LETTERS[cursor.getDay()];
        cells.push(keys.has(key) ? dayLetter : '_');
    }

    return cells.join(' ');
}

export function formatHabitItem(habit: GoalItem, todayDateKey: string): string {
    const completions = habit.habitCompletions ?? [];
    const streak = calculateCurrentStreak(completions, todayDateKey);
    const indicator = buildSevenDayIndicator(completions, todayDateKey);
    return `- ${habit.title} (daily, streak ${streak}, last 7 days: ${indicator})`;
}

function truncateToMaxChars(text: string, maxChars: number): string {
    if (text.length <= maxChars) {
        return text;
    }

    const truncationNote = '\n... [truncated]';
    const available = maxChars - truncationNote.length;
    if (available <= 0) {
        return text.slice(0, maxChars);
    }

    const lastNewline = text.lastIndexOf('\n', available);
    const cutIndex = lastNewline > 0 ? lastNewline : available;
    return text.slice(0, cutIndex) + truncationNote;
}

export function buildGoalsContext(
    goals: GoalItem[],
    options?: BuildGoalsContextOptions
): string | undefined {
    const todayDateKey = toTodayDateKey(options);
    const maxGoals = options?.maxGoals ?? DEFAULT_MAX_GOALS;
    const maxHabits = options?.maxHabits ?? DEFAULT_MAX_HABITS;
    const maxChars = options?.maxChars ?? DEFAULT_MAX_CHARS;

    const activeGoals = goals.filter(isActiveGoal);
    const habits = goals.filter((item) => item.type === 'habit');

    if (activeGoals.length === 0 && habits.length === 0) {
        return undefined;
    }

    const todayGoals = prioritizeIntentionId(
        activeGoals.filter((goal) => goal.dateKey === todayDateKey),
        options?.intentionId
    );

    const otherGoals = prioritizeIntentionId(
        activeGoals.filter((goal) => goal.dateKey !== todayDateKey),
        options?.intentionId
    );

    const sortedHabits = prioritizeIntentionId(habits, options?.intentionId);

    const lines: string[] = ["## User's Current Goals and Habits"];

    if (todayGoals.length > 0) {
        lines.push("");
        lines.push("### Today's focus");
        todayGoals
            .slice(0, maxGoals)
            .forEach((goal) => lines.push(formatGoalItem(goal)));
    }

    const remainingGoalSlots = Math.max(0, maxGoals - todayGoals.length);
    if (otherGoals.length > 0 && remainingGoalSlots > 0) {
        lines.push("");
        lines.push('### Goals');
        otherGoals
            .slice(0, remainingGoalSlots)
            .forEach((goal) => lines.push(formatGoalItem(goal)));
    }

    if (sortedHabits.length > 0) {
        lines.push("");
        lines.push('### Habits');
        sortedHabits
            .slice(0, maxHabits)
            .forEach((habit) => lines.push(formatHabitItem(habit, todayDateKey)));
    }

    const output = lines.join('\n');
    return truncateToMaxChars(output, maxChars);
}
