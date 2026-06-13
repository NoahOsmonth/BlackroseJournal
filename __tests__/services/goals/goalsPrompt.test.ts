/**
 * Goals prompt formatter tests
 */

import { buildGoalsContext, formatGoalItem, formatHabitItem } from '../../../services/goals/goalsPrompt';
import type { GoalItem } from '../../../services/goals/goalsStorage.types';

const todayDateKey = '2026-06-13';

function makeGoal(overrides: Partial<GoalItem> & Pick<GoalItem, 'id' | 'title'>): GoalItem {
    return {
        type: 'goal',
        completed: false,
        createdAt: 1,
        updatedAt: 1,
        ...overrides,
    } as GoalItem;
}

function makeHabit(overrides: Partial<GoalItem> & Pick<GoalItem, 'id' | 'title'>): GoalItem {
    return {
        type: 'habit',
        habitCompletions: [],
        createdAt: 1,
        updatedAt: 1,
        ...overrides,
    } as GoalItem;
}

describe('formatGoalItem', () => {
    it('formats an active goal as a markdown bullet', () => {
        const goal = makeGoal({ id: 'g1', title: 'Run a half-marathon' });
        expect(formatGoalItem(goal)).toBe('- Run a half-marathon (Goal)');
    });
});

describe('formatHabitItem', () => {
    it('formats a habit with zero streak and empty 7-day indicator', () => {
        const habit = makeHabit({ id: 'h1', title: 'Morning meditation' });
        const out = formatHabitItem(habit, todayDateKey);
        expect(out).toContain('- Morning meditation (daily');
        expect(out).toContain('streak 0');
        expect(out).toContain('last 7 days:');
    });

    it('shows current streak and completed days in 7-day indicator', () => {
        const habit = makeHabit({
            id: 'h1',
            title: 'Morning meditation',
            habitCompletions: [
                '2026-06-13',
                '2026-06-12',
                '2026-06-11',
                '2026-06-10',
                '2026-06-09',
            ],
        });
        const out = formatHabitItem(habit, todayDateKey);
        expect(out).toContain('streak 5');
        expect(out).toMatch(/last 7 days: [xX _]+/);
    });

    it('ignores future completions when computing streak', () => {
        const habit = makeHabit({
            id: 'h1',
            title: 'Read',
            habitCompletions: ['2026-06-14', '2026-06-13', '2026-06-12'],
        });
        const out = formatHabitItem(habit, todayDateKey);
        expect(out).toContain('streak 2');
    });
});

describe('buildGoalsContext', () => {
    it('returns undefined when there are no active goals or habits', () => {
        expect(buildGoalsContext([], { todayDateKey })).toBeUndefined();
    });

    it('omits completed goals but includes active goals and all habits', () => {
        const goal = makeGoal({ id: 'g1', title: 'Active goal', updatedAt: 3 });
        const completed = makeGoal({ id: 'g2', title: 'Done', completed: true, updatedAt: 2 });
        const habit = makeHabit({ id: 'h1', title: 'Daily habit', updatedAt: 1 });

        const out = buildGoalsContext([goal, completed, habit], { todayDateKey });
        expect(out).toBeDefined();
        expect(out).toContain('## User\'s Current Goals and Habits');
        expect(out).toContain('- Active goal (Goal)');
        expect(out).not.toContain('Done');
        expect(out).toContain('- Daily habit (daily');
    });

    it('lists today\'s focus goals first under their own heading', () => {
        const todayGoal = makeGoal({
            id: 'g1',
            title: 'Today focus',
            dateKey: todayDateKey,
            updatedAt: 2,
        });
        const otherGoal = makeGoal({ id: 'g2', title: 'Other goal', updatedAt: 1 });

        const out = buildGoalsContext([otherGoal, todayGoal], { todayDateKey });
        expect(out).toContain('### Today\'s focus');
        expect(out).toContain('- Today focus (Goal)');
        expect(out).toContain('### Goals');
        expect(out).toContain('- Other goal (Goal)');
        expect(out!.indexOf('Today focus')).toBeLessThan(out!.indexOf('Other goal'));
    });

    it('sorts goals and habits by updatedAt descending', () => {
        const goalA = makeGoal({ id: 'g1', title: 'A', updatedAt: 1 });
        const goalB = makeGoal({ id: 'g2', title: 'B', updatedAt: 3 });
        const goalC = makeGoal({ id: 'g3', title: 'C', updatedAt: 2 });

        const out = buildGoalsContext([goalA, goalB, goalC], { todayDateKey });
        expect(out).toBeDefined();
        const idxA = out!.indexOf('- A (Goal)');
        const idxB = out!.indexOf('- B (Goal)');
        const idxC = out!.indexOf('- C (Goal)');
        expect(idxB).toBeLessThan(idxC);
        expect(idxC).toBeLessThan(idxA);
    });

    it('caps goals and habits at 10 items each', () => {
        const goals = Array.from({ length: 15 }, (_, i) =>
            makeGoal({ id: `g${i}`, title: `Goal ${i}`, updatedAt: 15 - i })
        );
        const habits = Array.from({ length: 15 }, (_, i) =>
            makeHabit({ id: `h${i}`, title: `Habit ${i}`, updatedAt: 15 - i })
        );

        const out = buildGoalsContext([...goals, ...habits], { todayDateKey });
        expect(out).toBeDefined();
        const goalBullets = (out!.match(/- Goal \d+ \(Goal\)/g) ?? []).length;
        const habitBullets = (out!.match(/- Habit \d+ \(daily/g) ?? []).length;
        expect(goalBullets).toBe(10);
        expect(habitBullets).toBe(10);
    });

    it('truncates gracefully when output exceeds the character cap', () => {
        const goals = Array.from({ length: 10 }, (_, i) =>
            makeGoal({
                id: `g${i}`,
                title: 'A very long goal title that consumes many characters '.repeat(5),
                updatedAt: 10 - i,
            })
        );

        const out = buildGoalsContext(goals, { todayDateKey, maxChars: 200 });
        expect(out).toBeDefined();
        expect(out!.length).toBeLessThanOrEqual(200);
        expect(out).toContain('## User\'s Current Goals and Habits');
    });

    it('places intention-linked goals first when intentionId is provided', () => {
        const linked = makeGoal({
            id: 'g1',
            title: 'Linked goal',
            intentionId: 'int-1',
            updatedAt: 1,
        });
        const unlinked = makeGoal({ id: 'g2', title: 'Unlinked goal', updatedAt: 2 });

        const out = buildGoalsContext([unlinked, linked], {
            todayDateKey,
            intentionId: 'int-1',
        });
        expect(out).toBeDefined();
        const idxLinked = out!.indexOf('- Linked goal (Goal)');
        const idxUnlinked = out!.indexOf('- Unlinked goal (Goal)');
        expect(idxLinked).toBeLessThan(idxUnlinked);
    });
});
