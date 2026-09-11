import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { TodayWritingCard } from '../../../components/today/TodayWritingCard';

describe('TodayWritingCard', () => {
    it('shows the Blackrose prompt and opens the write surface on press', () => {
        const onPress = jest.fn();
        render(<TodayWritingCard onPress={onPress} />);

        expect(screen.getByText('What wants your attention?')).toBeTruthy();

        fireEvent.press(screen.getByTestId('today-writing-card'));
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('accepts a custom prompt without changing the accessibility contract', () => {
        render(<TodayWritingCard placeholder="Write what's true…" />);

        expect(screen.getByLabelText("Write what's true…")).toBeTruthy();
        expect(screen.queryByText('What wants your attention?')).toBeNull();
    });
});
