import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import AskRosebudScreen from '../../app/ask-rosebud';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
    useRouter: () => ({ back: jest.fn(), push: mockPush }),
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

describe('AskRosebud saved insights link', () => {
    beforeEach(() => {
        mockPush.mockClear();
    });

    it('links to saved insights from the Ask screen', () => {
        render(<AskRosebudScreen />);

        const savedInsights = screen.getByLabelText('Open saved insights');
        expect(savedInsights).toBeTruthy();

        fireEvent.press(savedInsights);

        expect(mockPush).toHaveBeenCalledWith('/saved-insights');
    });
});
