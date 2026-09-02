import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { EmptyState } from '../../components/ui/EmptyState';

jest.mock('@expo/vector-icons/MaterialIcons', () => {
    const React = jest.requireActual('react');
    const { Text } = jest.requireActual('react-native');
    return {
        __esModule: true,
        default: ({ name }: { name: string }) => <Text>{name}</Text>,
    };
});

jest.mock('../../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

describe('EmptyState', () => {
    it('renders title, message, icon, and optional CTA', () => {
        const onPress = jest.fn();
        render(
            <EmptyState
                title="Memory starts here"
                message="Write an entry to build your memory."
                icon="psychology"
                actionLabel="Start entry"
                onActionPress={onPress}
            />
        );

        fireEvent.press(screen.getByLabelText('Start entry'));

        expect(screen.getByText('psychology')).toBeTruthy();
        expect(screen.getByText('Memory starts here')).toBeTruthy();
        expect(screen.getByText('Write an entry to build your memory.')).toBeTruthy();
        expect(onPress).toHaveBeenCalledTimes(1);
    });
});
