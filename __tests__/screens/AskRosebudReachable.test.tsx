import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import InsightsScreen from '../../app/(tabs)/insights';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
    useRouter: () => ({ push: mockPush }),
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
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('../../components/journal', () => ({
    BottomNav: () => {
        const { Text } = jest.requireActual('react-native');
        return <Text>Bottom navigation</Text>;
    },
}));

jest.mock('../../components/ui/SpatialView', () => ({
    SpatialView: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

jest.mock('../../hooks/useThemeSettings', () => ({
    useThemeSettings: () => ({ emojiStyle: 'native' }),
}));

jest.mock('../../hooks/useWeeklyInsights', () => ({
    useWeeklyInsights: () => ({
        insights: {
            emotionalLandscape: [],
            keyThemes: [],
            castOfCharacters: [],
            weeklySummary: 'No entries yet this week.',
        },
        weeklyStats: {
            entriesCount: 2,
            totalWords: 120,
            dailyWords: [0, 40, 0, 80, 0, 0, 0],
            maxWords: 80,
        },
        weekDateRange: 'Jun 7 - Jun 13',
        isLoading: false,
    }),
}));

describe('Insights Ask Rosebud entry point', () => {
    beforeEach(() => {
        mockPush.mockClear();
    });

    it('renders Ask Rosebud and navigates to the journal Q&A screen', () => {
        render(<InsightsScreen />);

        fireEvent.press(screen.getByLabelText('Ask about your journal'));

        expect(screen.getByText('Ask about your journal')).toBeTruthy();
        expect(mockPush).toHaveBeenCalledWith('/ask-rosebud');
    });
});
