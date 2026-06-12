import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import AskRosebudScreen from '../../app/ask-rosebud';

jest.mock('expo-router', () => ({
    useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: ({ name }: { name: string }) => {
        const React = jest.requireActual('react');
        const { Text } = jest.requireActual('react-native');
        return <Text>{name}</Text>;
    },
}));

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: { children: React.ReactNode }) => {
        const { View } = jest.requireActual('react-native');
        return <View>{children}</View>;
    },
}));

jest.mock('../../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

jest.mock('../../hooks/use-theme-color', () => ({
    useThemeColor: () => '#FF9F0A',
}));

jest.mock('../../hooks/useJournalEntries', () => ({
    useJournalEntries: () => ({
        completed: [
            {
                id: 'entry-1',
                createdAt: new Date().toISOString(),
                messages: [{ role: 'user', content: 'A clear morning.' }],
            },
        ],
    }),
}));

jest.mock('../../hooks/useAskRosebud', () => ({
    useAskRosebud: () => ({
        messages: [],
        isLoading: false,
        errorMessage: null,
        sendQuestion: jest.fn(),
    }),
}));

describe('Ask Rosebud time range filter', () => {
    it('defaults to "All entries" and cycles through labels', () => {
        render(<AskRosebudScreen />);

        const timeRangeButton = screen.getByText('All entries');
        expect(timeRangeButton).toBeTruthy();

        fireEvent.press(timeRangeButton);
        expect(screen.getByText('All-time')).toBeTruthy();

        fireEvent.press(screen.getByText('All-time'));
        expect(screen.getByText('This year')).toBeTruthy();

        fireEvent.press(screen.getByText('This year'));
        expect(screen.getByText('This month')).toBeTruthy();

        fireEvent.press(screen.getByText('This month'));
        expect(screen.getByText('This week')).toBeTruthy();

        fireEvent.press(screen.getByText('This week'));
        expect(screen.getByText('All entries')).toBeTruthy();
    });
});
