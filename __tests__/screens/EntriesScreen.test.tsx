// Mock AsyncStorage before imports
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
}));

import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import EntriesScreen from '../../app/(tabs)/entries';

// Mock navigation/router
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

// Mock vector icons
jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: 'MaterialIcons',
    Ionicons: 'Ionicons',
}));

// Mock color scheme hook
jest.mock('@/hooks/theme/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

// Keep EntriesScreen lightweight for this test
jest.mock('@/hooks/journal/useJournalEntries', () => ({
    useJournalEntries: () => ({
        completed: [],
        drafts: [],
        isLoading: false,
    }),
}));

jest.mock('@/hooks/journal/useEntryGroups', () => ({
    groupEntriesByWeek: () => [],
}));

// Mock safe area
jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('EntriesScreen (Journal History)', () => {
    beforeEach(() => {
        mockPush.mockClear();
        mockNavigate.mockClear();
    });

    it('navigates to settings when header menu icon is pressed', () => {
        render(<EntriesScreen />);

        const menuButton = screen.getByLabelText('Open settings');
        fireEvent.press(menuButton);

        expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/settings');
    });

    it('navigates to rewards when header gift icon is pressed', () => {
        render(<EntriesScreen />);

        const giftButton = screen.getByLabelText('Open rewards');
        fireEvent.press(giftButton);

        expect(mockPush).toHaveBeenCalledWith('/rewards');
    });
});
