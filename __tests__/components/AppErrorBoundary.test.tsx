import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AppErrorBoundary } from '@/components/system/AppErrorBoundary';

const Thrower = () => {
    throw new Error('Boom');
};

describe('AppErrorBoundary', () => {
    const consoleError = console.error;

    beforeEach(() => {
        console.error = jest.fn();
    });

    afterEach(() => {
        console.error = consoleError;
    });

    it('renders children when no error', () => {
        render(
            <AppErrorBoundary>
                <Text>Content</Text>
            </AppErrorBoundary>
        );

        expect(screen.getByText('Content')).toBeTruthy();
    });

    it('shows fallback UI and allows reset', () => {
        render(
            <AppErrorBoundary>
                <Thrower />
            </AppErrorBoundary>
        );

        expect(screen.getByText('Something went wrong')).toBeTruthy();
        expect(screen.getByText('Boom')).toBeTruthy();

        fireEvent.press(screen.getByLabelText('Try again'));
        expect(screen.getByText('Something went wrong')).toBeTruthy();
    });
});
