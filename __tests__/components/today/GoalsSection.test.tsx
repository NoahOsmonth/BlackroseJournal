import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import {
    GoalsSection,
    buildGoalListItems,
    type GoalListItem,
} from '../../../components/today/GoalsSection';
import type { GoalItem } from '@/services/goals/goalsStorage.types';

jest.mock('../../../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: () => null,
}));

const baseItems: GoalListItem[] = [
    { id: 'g1', title: 'Write journal', type: 'goal', completed: false },
    { id: 'h1', title: 'Walk', type: 'habit', completed: true },
];

describe('buildGoalListItems', () => {
    it('maps goals and habits with completion for the date', () => {
        const goals: GoalItem[] = [{
            id: 'g1',
            title: 'Ship feature',
            type: 'goal',
            dateKey: '2026-07-10',
            completed: true,
            createdAt: 1,
            updatedAt: 1,
        }];
        const habits: GoalItem[] = [{
            id: 'h1',
            title: 'Meditate',
            type: 'habit',
            habitCompletions: ['2026-07-10'],
            createdAt: 1,
            updatedAt: 1,
        }];
        expect(buildGoalListItems(goals, habits, '2026-07-10')).toEqual([
            { id: 'g1', title: 'Ship feature', type: 'goal', completed: true },
            { id: 'h1', title: 'Meditate', type: 'habit', completed: true },
        ]);
    });
});

describe('GoalsSection', () => {
    it('shows empty copy when there are no items', () => {
        render(
            <GoalsSection
                items={[]}
                onAddGoal={jest.fn()}
                onManage={jest.fn()}
                onToggle={jest.fn()}
            />
        );

        expect(screen.getByText(/No goals yet/)).toBeTruthy();
        expect(screen.getByLabelText('Add goal')).toBeTruthy();
        expect(screen.getByLabelText('Manage goals')).toBeTruthy();
    });

    it('renders checklist rows and fires toggle', () => {
        const onToggle = jest.fn();
        render(
            <GoalsSection
                items={baseItems}
                onAddGoal={jest.fn()}
                onManage={jest.fn()}
                onToggle={onToggle}
            />
        );

        expect(screen.getByText('Write journal')).toBeTruthy();
        expect(screen.getByText('Walk')).toBeTruthy();
        expect(screen.getByText('1/2')).toBeTruthy();
        fireEvent.press(screen.getByLabelText('Write journal, goal'));
        expect(onToggle).toHaveBeenCalledWith('g1');
    });
});
