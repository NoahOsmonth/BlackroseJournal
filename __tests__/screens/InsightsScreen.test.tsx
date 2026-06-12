import React from 'react';
import { render, screen } from '@testing-library/react-native';

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
            entriesCount: 3,
            totalWords: 2350,
            dailyWords: [0, 450, 0, 1247, 0, 653, 0],
            maxWords: 1247,
        },
        weekDateRange: 'Jun 7 - Jun 13',
        isLoading: false,
    }),
}));

describe('InsightsScreen', () => {
    beforeEach(() => {
        mockPush.mockClear();
    });

    it('renders the Daily Activity max-word label from the hook', () => {
        render(<InsightsScreen />);

        expect(screen.getByText('Max: 1247 words')).toBeTruthy();
    });
});
