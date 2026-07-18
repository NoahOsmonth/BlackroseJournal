import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ModelHeaderControl } from '../../components/ai/ModelHeaderControl';

jest.mock('../../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: () => null,
}));

jest.mock('../../hooks/settings/useActiveModelContext', () => ({
    useActiveModelContext: () => ({
        context: {
            model: 'tencent/hy3:free',
            contextWindow: 262_000,
            source: 'api',
            providerSource: 'custom',
        },
        error: null,
        isLoading: false,
        refresh: jest.fn(),
    }),
}));

describe('ModelHeaderControl', () => {
    it('shows free badge and truncated model label', () => {
        render(<ModelHeaderControl onPress={jest.fn()} />);
        expect(screen.getByText('Free')).toBeTruthy();
        expect(screen.getByText(/hy3/i)).toBeTruthy();
        expect(screen.getByText(/262k/i)).toBeTruthy();
    });

    it('invokes onPress when enabled', () => {
        const onPress = jest.fn();
        render(<ModelHeaderControl onPress={onPress} />);
        fireEvent.press(screen.getByLabelText(/Model:/i));
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('does not open when disabled', () => {
        const onPress = jest.fn();
        render(<ModelHeaderControl onPress={onPress} disabled />);
        fireEvent.press(screen.getByLabelText(/Model:/i));
        expect(onPress).not.toHaveBeenCalled();
    });
});
