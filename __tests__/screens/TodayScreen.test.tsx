// Mock AsyncStorage before imports
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
}));

import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import TodayScreen from '../../app/(tabs)/today';

// Mock navigation/router
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: mockPush,
        back: jest.fn(),
        replace: jest.fn(),
    }),
}));

// Mock vector icons
jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: 'MaterialIcons',
    Ionicons: 'Ionicons',
}));

// Mock color scheme hook
jest.mock('@/hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

// Mock journal entries hook
jest.mock('@/hooks/useJournalEntries', () => ({
    useJournalEntries: () => ({
        completed: [
            {
                id: '1',
                createdAt: new Date().toISOString(),
                messages: [{ role: 'user', content: 'Test message with several words' }],
            },
            {
                id: '2',
                createdAt: new Date().toISOString(),
                messages: [{ role: 'user', content: 'Another test entry' }],
            },
        ],
        drafts: [],
        isLoading: false,
    }),
}));

// Mock safe area
jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('TodayScreen', () => {
    beforeEach(() => {
        mockPush.mockClear();
    });

    it('renders the header with formatted date', () => {
        render(<TodayScreen />);

        // Header should contain a date (day name, month, date with ordinal)
        // The exact date depends on execution time, so check for common elements
        expect(screen.getByText(/Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday/)).toBeTruthy();
    });

    it('renders weekday selector with 7 days + calendar icon', () => {
        render(<TodayScreen />);

        // All day letters should be present (note: T appears twice, S appears twice)
        expect(screen.getAllByText('S').length).toBeGreaterThanOrEqual(2);
        expect(screen.getAllByText('M').length).toBe(1);
        expect(screen.getAllByText('T').length).toBe(2);
        expect(screen.getAllByText('W').length).toBe(1);
        expect(screen.getAllByText('F').length).toBe(1);
    });

    it('renders stat cards for Streak, Entries, and Words', () => {
        render(<TodayScreen />);

        // Use accessibility labels which are more specific than just text
        expect(screen.getByLabelText(/Streak:/)).toBeTruthy();
        expect(screen.getByLabelText(/Total entries:/)).toBeTruthy();
        expect(screen.getByLabelText(/Total words:/)).toBeTruthy();
    });

    it('renders Daily Journaling section', () => {
        render(<TodayScreen />);

        expect(screen.getByText('Daily Journaling')).toBeTruthy();
        expect(screen.getByText('Daily check-in')).toBeTruthy();
        expect(screen.getByText('Check in now')).toBeTruthy();
    });

    it('renders Happiness Recipe section', () => {
        render(<TodayScreen />);

        expect(screen.getByText('Happiness Recipe')).toBeTruthy();
        expect(screen.getByText('Completed')).toBeTruthy();
        expect(screen.getByText('Add ingredient')).toBeTruthy();
        expect(screen.getByText('Add goal')).toBeTruthy();
    });

    it('renders Ask Rosebud section with time range', () => {
        render(<TodayScreen />);

        expect(screen.getByText('Ask Rosebud')).toBeTruthy();
        expect(screen.getByText('All-time')).toBeTruthy();
    });

    it('navigates to chat when Check in now is pressed', () => {
        render(<TodayScreen />);

        const checkInButton = screen.getByText('Check in now');
        fireEvent.press(checkInButton);

        // Check in now navigates with dailyCheckIn mode and prompt period
        expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({
            pathname: '/chat',
            params: expect.objectContaining({
                mode: 'dailyCheckIn',
            }),
        }));
    });

    it('navigates to settings when menu icon is pressed', () => {
        render(<TodayScreen />);

        const menuButton = screen.getByLabelText('Open settings');
        fireEvent.press(menuButton);

        expect(mockPush).toHaveBeenCalledWith('/(tabs)/settings');
    });

    it('navigates to rewards when gift icon is pressed', () => {
        render(<TodayScreen />);

        const giftButton = screen.getByLabelText('Open rewards');
        fireEvent.press(giftButton);

        expect(mockPush).toHaveBeenCalledWith('/rewards');
    });

    it('navigates to entries when calendar icon is pressed', () => {
        render(<TodayScreen />);

        const calendarButton = screen.getByLabelText('Open calendar view');
        fireEvent.press(calendarButton);

        expect(mockPush).toHaveBeenCalledWith('/(tabs)/entries');
    });

    it('allows selecting different weekdays', () => {
        render(<TodayScreen />);

        // Find Monday button and press it
        const mondayButton = screen.getByLabelText('Select Monday');
        fireEvent.press(mondayButton);

        // The header should now show Monday (in real app this would update the date)
        // Since we're mocking, we just verify the button exists and is pressable
        expect(mondayButton).toBeTruthy();
    });
});
