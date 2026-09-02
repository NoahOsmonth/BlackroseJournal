import { formatHabitItem, formatGoalItem, buildGoalsContext } from '../../../services/goals/goalsPrompt';
import type { GoalItem } from '../../../services/goals/goalsStorage.types';

function habit(overrides: Partial<GoalItem> = {}): GoalItem {
    return {
        id: 'h1',
        title: 'Walk',
        type: 'habit',
        habitCompletions: [],
        updatedAt: 0,
        ...overrides,
    } as GoalItem;
}

describe('goals prompt habit streak (probe)', () => {
    it('streak counts consecutive days ending today incl. today', () => {
        const h = habit({
            habitCompletions: ['2026-07-11', '2026-07-12', '2026-07-13'],
        });
        const line = formatHabitItem(h, '2026-07-13');
        expect(line).toContain('streak 3');
    });

    it('streak is 0 when today is missed even if yesterday+others were done', () => {
        const h = habit({
            habitCompletions: ['2026-07-10', '2026-07-11', '2026-07-12'], // stopped before today 13
        });
        const line = formatHabitItem(h, '2026-07-13');
        expect(line).toContain('streak 0');
    });

    it('seven-day indicator marks only completed days; Sunday completion shows S in the 6th cell', () => {
        const h = habit({ habitCompletions: ['2026-07-12'] });
        // Today 2026-07-13 is Monday. The window is the last 7 days in Sun..Sat
        // order ending with today: Sun(07-07)..Sat(07-13) → cells 0..6. The only
        // completion is Sunday 07-12 = cell index 5.
        const line = formatHabitItem(h, '2026-07-13');
        expect(line).toContain('_ _ _ _ _ S _');
    });

    it('only lists active goals, excludes completed', () => {
        const active = { id: 'g1', type: 'goal', title: 'Run', completed: false, updatedAt: 1 } as GoalItem;
        const done = { id: 'g2', type: 'goal', title: 'Done goal', completed: true, updatedAt: 2 } as GoalItem;
        const ctx = buildGoalsContext([active, done], { todayDateKey: '2026-07-13' });
        expect(ctx).toContain('Run (Goal)');
        expect(ctx).not.toContain('Done goal');
    });
});