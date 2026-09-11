import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { TodayRitualRow } from '../../../components/today/TodayRitualRow';

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: () => null,
}));

describe('TodayRitualRow', () => {
    it('shows the open label and fires the press handler', () => {
        const onPress = jest.fn();
        render(<TodayRitualRow title="Morning note" onPress={onPress} />);

        expect(screen.getByText('Morning note')).toBeTruthy();
        expect(screen.getByText('Open')).toBeTruthy();

        fireEvent.press(screen.getByLabelText('Morning note'));
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('replaces the open label with Done when completed', () => {
        render(<TodayRitualRow title="Evening close" isCompleted />);

        expect(screen.getByText('Evening close')).toBeTruthy();
        expect(screen.getByText('Done')).toBeTruthy();
        expect(screen.queryByText('Open')).toBeNull();
    });

    it('renders a hairline divider only when the row is not the last one', () => {
        render(<TodayRitualRow title="First" testID="row-first" />);
        expect(screen.getByTestId('row-first-divider')).toBeTruthy();

        render(<TodayRitualRow title="Last" showDivider={false} testID="row-last" />);
        expect(screen.queryByTestId('row-last-divider')).toBeNull();
    });
});
