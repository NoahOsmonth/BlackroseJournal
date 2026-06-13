import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { EntryInsightsCard } from '../../../components/today/EntryInsightsCard';

jest.mock('../../../hooks/theme/use-theme-color', () => ({
    useThemeColor: () => '#6B7280',
}));

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: () => null,
}));

describe('EntryInsightsCard', () => {
    const defaultProps = {
        question: 'What made you feel energized today?',
        onRefresh: jest.fn(),
        onBookmark: jest.fn(),
        onMore: jest.fn(),
        onPress: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the insight question and label', () => {
        render(<EntryInsightsCard {...defaultProps} />);

        expect(screen.getByText('Based on your entries')).toBeTruthy();
        expect(screen.getByText(defaultProps.question)).toBeTruthy();
        expect(screen.getByLabelText('Open insight conversation')).toBeTruthy();
    });

    it('fires onPress when the question area is pressed', () => {
        render(<EntryInsightsCard {...defaultProps} />);

        fireEvent.press(screen.getByLabelText('Open insight conversation'));

        expect(defaultProps.onPress).toHaveBeenCalledTimes(1);
    });

    it('fires onRefresh and stops propagation so onPress is not triggered', () => {
        render(<EntryInsightsCard {...defaultProps} />);

        fireEvent.press(screen.getByLabelText('Refresh insight'), {
            stopPropagation: jest.fn(),
        });

        expect(defaultProps.onRefresh).toHaveBeenCalledTimes(1);
        expect(defaultProps.onPress).not.toHaveBeenCalled();
    });

    it('fires onBookmark and stops propagation so onPress is not triggered', () => {
        render(<EntryInsightsCard {...defaultProps} />);

        fireEvent.press(screen.getByLabelText('Save insight'), {
            stopPropagation: jest.fn(),
        });

        expect(defaultProps.onBookmark).toHaveBeenCalledTimes(1);
        expect(defaultProps.onPress).not.toHaveBeenCalled();
    });

    it('fires onMore and stops propagation so onPress is not triggered', () => {
        render(<EntryInsightsCard {...defaultProps} />);

        fireEvent.press(screen.getByLabelText('More options'), {
            stopPropagation: jest.fn(),
        });

        expect(defaultProps.onMore).toHaveBeenCalledTimes(1);
        expect(defaultProps.onPress).not.toHaveBeenCalled();
    });

    it('does not render as pressable when onPress is omitted', () => {
        const { onPress, ...rest } = defaultProps;
        render(<EntryInsightsCard {...rest} />);

        const pressable = screen.getByLabelText('Open insight conversation');
        expect(pressable.props.accessibilityState?.disabled).toBe(true);
    });
});
