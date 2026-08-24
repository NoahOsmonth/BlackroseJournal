/* eslint-disable import/first */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { mockReanimated } from '../mocks/reanimatedMock';

jest.mock('react-native-reanimated', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text, View } = require('react-native');
    const base = mockReanimated();
    return {
        ...base,
        Animated: { ...base.default, View, Text },
        FadeIn: { duration: () => ({}) },
        FadeOut: { duration: () => ({}) },
    };
});

jest.mock('react-native-confetti-reanimated', () => ({
    ConfettiCanvas: () => null,
    useConfetti: () => ({ confettiRef: { current: null }, fire: jest.fn(), reset: jest.fn() }),
    presets: { basicCannon: {} },
}));

jest.mock('@/hooks/use-color-scheme', () => ({
    useColorScheme: () => 'dark',
}));

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: jest.fn(() => null),
}));

import { SuccessOverlay } from '../../components/celebrations/SuccessOverlay';
import { EntryFinishCelebration } from '../../components/celebrations/EntryFinishCelebration';

describe('SuccessOverlay', () => {
    it('is hidden when not visible', () => {
        render(<SuccessOverlay visible={false} message="Entry saved ✨" />);
        expect(screen.queryByLabelText('Entry saved ✨')).toBeNull();
    });

    it('renders icon, message and fires onDismiss on backdrop tap', () => {
        const onDismiss = jest.fn();
        render(<SuccessOverlay visible message="Entry saved ✨" onDismiss={onDismiss} />);

        expect(screen.getByText('Entry saved ✨')).toBeTruthy();
        expect(screen.getByLabelText('Entry saved ✨')).toBeTruthy();

        fireEvent(screen.getByLabelText('Dismiss'), 'press');
        expect(onDismiss).toHaveBeenCalled();
    });

    it('renders and fires the action button when provided', () => {
        const onAction = jest.fn();
        render(
            <SuccessOverlay
                visible
                message="Done"
                actionLabel="View reflection"
                onAction={onAction}
            />
        );

        const button = screen.getByLabelText('View reflection');
        expect(button).toBeTruthy();
        fireEvent.press(button);
        expect(onAction).toHaveBeenCalled();
    });
});

describe('EntryFinishCelebration', () => {
    it('calls onDismiss when tapped', () => {
        const onDismiss = jest.fn();
        render(<EntryFinishCelebration onDismiss={onDismiss} />);

        fireEvent(screen.getByLabelText('Dismiss'), 'press');
        expect(onDismiss).toHaveBeenCalled();
    });

    it('announces the saved message accessibly', () => {
        render(<EntryFinishCelebration onDismiss={jest.fn()} />);
        expect(screen.getByLabelText('Entry saved ✨')).toBeTruthy();
    });
});