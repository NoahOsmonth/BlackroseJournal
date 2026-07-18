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

jest.mock('../../components/ui/StaggerEntrance', () => ({
    StaggerEntranceItem: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('../../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

jest.mock('../../hooks/useThemeSettings', () => ({
    useThemeSettings: () => ({ emojiStyle: 'native' }),
}));

jest.mock('../../hooks/navigation/useTabNavigation', () => ({
    useTabNavigation: () => ({ goToTab: jest.fn() }),
}));

const mockUseWeeklyInsights = jest.fn();

jest.mock('../../hooks/useWeeklyInsights', () => ({
    useWeeklyInsights: () => mockUseWeeklyInsights(),
}));

describe('InsightsScreen', () => {
    beforeEach(() => {
        mockPush.mockClear();
        mockUseWeeklyInsights.mockReturnValue({
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
        });
    });

    it('shows honest lock progress without Saturday theater', () => {
        render(<InsightsScreen />);

        expect(screen.getByText('Insights')).toBeTruthy();
        expect(screen.getByText(/3 of 5/)).toBeTruthy();
        expect(screen.queryByText(/Saturday/i)).toBeNull();
        expect(screen.queryByText(/AI Executive Summary/i)).toBeNull();
        expect(screen.getByText(/Writing this week/i)).toBeTruthy();
        expect(screen.getByText(/2,350 words/)).toBeTruthy();
        expect(screen.getByText(/Moods, themes, and people unlock/)).toBeTruthy();
    });

    it('routes write CTA to chat when locked', () => {
        render(<InsightsScreen />);
        fireEvent.press(screen.getByLabelText('Write an entry'));
        expect(mockPush).toHaveBeenCalledWith('/chat');
    });

    it('renders the week letter and meaning when unlocked', () => {
        mockUseWeeklyInsights.mockReturnValue({
            insights: {
                emotionalLandscape: [{ emotion: 'hopeful', score: 7, emoji: '🌅' }],
                keyThemes: ['Rest', 'Work'],
                castOfCharacters: ['Sam'],
                weeklySummary: 'A quieter week with more room to breathe.',
            },
            weeklyStats: {
                entriesCount: 5,
                totalWords: 900,
                dailyWords: [100, 100, 100, 100, 100, 200, 200],
                maxWords: 200,
            },
            weekDateRange: 'Jun 7 - Jun 13',
            isLoading: false,
        });

        render(<InsightsScreen />);

        expect(screen.getByText('A quieter week with more room to breathe.')).toBeTruthy();
        expect(screen.getByText('Rest')).toBeTruthy();
        expect(screen.getByText('Sam')).toBeTruthy();
        expect(screen.getByText('hopeful')).toBeTruthy();
    });
});
