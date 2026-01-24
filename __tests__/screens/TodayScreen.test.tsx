// Mock AsyncStorage before imports
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
}));

import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import TodayScreen from '../../app/(tabs)/today';

const mockPush = jest.fn();
const mockNavigate = jest.fn();

jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: mockPush,
        navigate: mockNavigate,
        back: jest.fn(),
        replace: jest.fn(),
    }),
}));

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: 'MaterialIcons',
    Ionicons: 'Ionicons',
}));

jest.mock('@/hooks/theme/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

jest.mock('@/hooks/journal/useJournalEntries', () => ({
    useJournalEntries: () => ({
        completed: [],
        drafts: [],
        isLoading: false,
    }),
}));

jest.mock('@/hooks/intentions/useIntentions', () => ({
    useIntentions: () => ({
        activeIntentions: [],
    }),
}));

jest.mock('@/hooks/intentions/useIntentionCheckIns', () => ({
    useIntentionCheckIns: () => ({
        completed: [],
    }),
}));

jest.mock('@/hooks/goals/useGoals', () => ({
    useGoals: () => ({
        goals: [],
    }),
}));

jest.mock('@/hooks/insights/useEntryInsightQuestion', () => ({
    useEntryInsightQuestion: () => ({
        question: 'Test insight question',
        refresh: jest.fn(),
        sourceDate: '2026-01-23',
    }),
}));

jest.mock('@/hooks/saved-insights/useSavedInsights', () => ({
    useSavedInsights: () => ({
        add: jest.fn(),
    }),
}));

jest.mock('@/hooks/navigation/useTabNavigation', () => ({
    useTabNavigation: () => ({
        goToTab: jest.fn(),
    }),
}));

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('TodayScreen', () => {
    beforeEach(() => {
        mockPush.mockClear();
        mockNavigate.mockClear();
    });

    it('renders key sections', () => {
        render(<TodayScreen />);

        expect(screen.getAllByText(/Today/).length).toBeGreaterThan(0);
        expect(screen.getByText('My intentions')).toBeTruthy();
        expect(screen.getByText("Today's goals")).toBeTruthy();
        expect(screen.getByText('Based on your entries')).toBeTruthy();
    });

    it('navigates to intention chat for morning card', () => {
        render(<TodayScreen />);

        fireEvent.press(screen.getByLabelText('Morning Intention'));

        expect(mockPush).toHaveBeenCalledWith({
            pathname: '/intentions/chat',
            params: { type: 'morning' },
        });
    });

    it('opens intention selection when add intention is pressed', () => {
        render(<TodayScreen />);

        fireEvent.press(screen.getByLabelText('Add intention'));

        expect(mockPush).toHaveBeenCalledWith('/intentions/select');
    });

    it('opens streak view from streak button', () => {
        render(<TodayScreen />);

        fireEvent.press(screen.getByLabelText('Open streak view'));

        expect(mockPush).toHaveBeenCalledWith('/streak-view');
    });

    it('opens settings from personalize button', () => {
        render(<TodayScreen />);

        fireEvent.press(screen.getByLabelText('Personalize'));

        expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/settings');
    });
});
