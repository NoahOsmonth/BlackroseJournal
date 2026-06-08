import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { TactileButton } from '../../components/ui/TactileButton';

jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    selectionAsync: jest.fn(),
    ImpactFeedbackStyle: {
        Light: 'light',
        Medium: 'medium',
    },
}));

jest.mock('../../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

describe('TactileButton', () => {
    it('renders with children and applies default properties', () => {
        const { getByText, getByTestId } = render(
            <TactileButton testID="tactile-btn">
                <Text>Tap Me</Text>
            </TactileButton>
        );

        expect(getByText('Tap Me')).toBeTruthy();
        expect(getByTestId('tactile-btn')).toBeTruthy();
    });
});
