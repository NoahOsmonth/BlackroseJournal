import React from 'react';
import { render, screen } from '@testing-library/react-native';

import InsightsScreen from '../../app/(tabs)/insights';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: mockPush,
        replace: jest.fn(),
        back: jest.fn(),
    }),
}));

jest.mock('@/hooks/useWeeklyInsights', () => ({
    useWeeklyInsights: () => ({
        insights: {
            emotionalLandscape: [],
            keyThemes: [],
            castOfCharacters: [],
            weeklySummary: '',
        },
        weeklyStats: {
            totalWords: 120,
            entriesCount: 3,
            dailyWords: [0, 20, 0, 40, 10, 0, 30],
        },
        weekDateRange: 'Jan 19 - Jan 25',
        isLoading: false,
    }),
}));

jest.mock('@/hooks/useThemeSettings', () => ({
    useThemeSettings: () => ({
        emojiStyle: 'native',
    }),
}));

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('InsightsScreen', () => {
    it('renders daily words bars with minimum height', () => {
        render(<InsightsScreen />);

        expect(screen.getByText('Daily words')).toBeTruthy();
        expect(screen.getByLabelText('Sunday 0 words')).toBeTruthy();

        const bars = screen.getAllByTestId(/daily-words-bar-/);
        expect(bars).toHaveLength(7);

        const zeroBarStyle = Array.isArray(bars[0].props.style)
            ? Object.assign({}, ...bars[0].props.style)
            : bars[0].props.style;

        expect(zeroBarStyle.height).toBeGreaterThan(0);
    });
});
