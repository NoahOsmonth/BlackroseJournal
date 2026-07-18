import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { WeekdaySelector } from '../../../components/today/WeekdaySelector';
import type { DayInfo } from '@/hooks/today/useSelectedDay';

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: () => null,
}));

function buildWeek(): DayInfo[] {
    return [0, 1, 2, 3, 4, 5, 6].map((dayIndex) => ({
        dayIndex,
        label: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][dayIndex],
        dayNumber: 10 + dayIndex,
        date: new Date(2026, 6, 10 + dayIndex),
        isToday: dayIndex === 0,
    }));
}

describe('WeekdaySelector', () => {
    it('marks the selected day and calls onDaySelect', () => {
        const onDaySelect = jest.fn();
        render(
            <WeekdaySelector
                weekDays={buildWeek()}
                selectedDayIndex={2}
                onDaySelect={onDaySelect}
                completedDayIndices={[1]}
            />
        );

        const selected = screen.getByLabelText('Select Tuesday');
        expect(selected.props.accessibilityState).toEqual({ selected: true });
        // Theme-safe selected text (not forced white)
        expect(screen.getByText('12')).toBeTruthy();

        fireEvent.press(screen.getByLabelText('Select Friday'));
        expect(onDaySelect).toHaveBeenCalledWith(5);
    });

    it('shows completed check for non-selected completed days', () => {
        render(
            <WeekdaySelector
                weekDays={buildWeek()}
                selectedDayIndex={0}
                onDaySelect={jest.fn()}
                completedDayIndices={[1]}
            />
        );

        expect(screen.getByLabelText('Select Monday').props.accessibilityState)
            .toEqual({ selected: false });
    });
});
