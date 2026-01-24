import React from 'react';
import { render, screen } from '@testing-library/react-native';

describe('RootLayout', () => {
    afterEach(() => {
        jest.resetModules();
    });

    it('renders without crashing when fonts are still loading', () => {
        jest.doMock('@/hooks/useThemeSettings', () => ({
            useThemeSettings: () => ({ isLoaded: false }),
        }));

        jest.doMock('@/hooks/use-color-scheme', () => ({
            useColorScheme: () => 'light',
        }));

        jest.doMock('@expo-google-fonts/playfair-display', () => ({
            useFonts: () => [false, null],
            PlayfairDisplay_400Regular: 'font',
            PlayfairDisplay_700Bold: 'font',
        }));

        jest.doMock('@expo-google-fonts/plus-jakarta-sans', () => ({
            PlusJakartaSans_400Regular: 'font',
            PlusJakartaSans_500Medium: 'font',
            PlusJakartaSans_600SemiBold: 'font',
            PlusJakartaSans_700Bold: 'font',
        }));

        jest.doMock('@expo-google-fonts/lato', () => ({
            Lato_400Regular: 'font',
            Lato_700Bold: 'font',
        }));

        jest.doMock('@expo-google-fonts/inter', () => ({
            Inter_400Regular: 'font',
            Inter_500Medium: 'font',
            Inter_600SemiBold: 'font',
            Inter_700Bold: 'font',
        }));

        jest.doMock('@/utils/dev/rawTextGuard', () => ({
            installRawTextGuard: jest.fn(),
        }));

        jest.doMock('expo-router', () => {
            const React = require('react');
            const Stack = ({ children }: { children: React.ReactNode }) =>
                React.createElement(React.Fragment, null, children);
            Stack.Screen = () => null;
            return { Stack };
        });

        jest.doMock('@react-navigation/native', () => ({
            ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
            DarkTheme: {},
            DefaultTheme: {},
        }));

        jest.doMock('expo-status-bar', () => ({
            StatusBar: () => null,
        }));

        jest.doMock('../../global.css', () => ({}));

        const RootLayout = require('../../app/_layout').default;

        render(<RootLayout />);

        expect(screen.queryByText('Something went wrong')).toBeNull();
    });
});
