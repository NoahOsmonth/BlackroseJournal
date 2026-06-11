import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import ExploreScreen from '../../app/(tabs)/explore';
import type { LocalMemoryAtom } from '../../services/memory/localMemory.types';

const mockPush = jest.fn();
const mockGoToTab = jest.fn();
const mockAddNote = jest.fn();
const mockAddGeneratedNote = jest.fn();
const mockRefreshGeneratedNote = jest.fn();
const mockRemoveAtom = jest.fn();
const mockClearAll = jest.fn();

let mockMemoryState: {
    atoms: LocalMemoryAtom[];
    isLoading: boolean;
    generatedNote: string;
    refresh: jest.Mock;
    addNote: jest.Mock;
    addGeneratedNote: jest.Mock;
    refreshGeneratedNote: jest.Mock;
    removeAtom: jest.Mock;
    clearAll: jest.Mock;
};

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

jest.mock('../../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

jest.mock('../../hooks/navigation/useTabNavigation', () => ({
    useTabNavigation: () => ({ goToTab: mockGoToTab }),
}));

jest.mock('../../hooks/memory/useLocalMemories', () => ({
    useLocalMemories: () => mockMemoryState,
}));

const atoms: LocalMemoryAtom[] = [
    {
        id: 'profile-1',
        layer: 'profile',
        source: 'journal',
        title: 'About the user',
        content: 'Recent journal pattern: quieter evenings help.',
        tags: ['rest', 'evening'],
        salience: 0.82,
        confidence: 0.76,
        createdAt: 1,
        updatedAt: 3,
        accessCount: 0,
    },
    {
        id: 'semantic-1',
        layer: 'semantic',
        source: 'journal',
        title: 'Theme: Sleep',
        content: 'The user is tracking sleep routines.',
        tags: ['sleep', 'rest'],
        salience: 0.7,
        confidence: 0.72,
        createdAt: 1,
        updatedAt: 2,
        accessCount: 0,
    },
    {
        id: 'episodic-1',
        layer: 'episodic',
        source: 'journal',
        title: 'Work meeting',
        content: 'The user wrote about a difficult work meeting.',
        tags: ['work'],
        salience: 0.65,
        confidence: 0.8,
        createdAt: 1,
        updatedAt: 1,
        accessCount: 0,
    },
];

describe('ExploreScreen memory hub', () => {
    beforeEach(() => {
        mockPush.mockClear();
        mockGoToTab.mockClear();
        mockAddNote.mockResolvedValue(undefined);
        mockAddGeneratedNote.mockResolvedValue(undefined);
        mockRefreshGeneratedNote.mockClear();
        mockRemoveAtom.mockResolvedValue(undefined);
        mockClearAll.mockResolvedValue(undefined);
        mockMemoryState = {
            atoms,
            isLoading: false,
            generatedNote: 'Remember for Rosebud chats: quieter evenings help.',
            refresh: jest.fn(),
            addNote: mockAddNote,
            addGeneratedNote: mockAddGeneratedNote,
            refreshGeneratedNote: mockRefreshGeneratedNote,
            removeAtom: mockRemoveAtom,
            clearAll: mockClearAll,
        };
        jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
            const action = buttons?.find((button) => button.text === 'Delete');
            action?.onPress?.();
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('renders the Memory hub and opens the graph route', () => {
        render(<ExploreScreen />);

        fireEvent.press(screen.getByLabelText('Explore memory graph'));

        expect(screen.getByText('Memory')).toBeTruthy();
        expect(screen.getAllByText('Recent journal pattern: quieter evenings help.').length)
            .toBeGreaterThan(0);
        expect(screen.getByText('Generated note')).toBeTruthy();
        expect(screen.getByText('Memory atoms')).toBeTruthy();
        expect(mockPush).toHaveBeenCalledWith('/memory-graph');
    });

    it('saves notes, filters atoms, and deletes an atom', async () => {
        render(<ExploreScreen />);

        fireEvent.changeText(screen.getByLabelText('Memory note'), 'Keep Sundays quiet.');
        fireEvent.press(screen.getByLabelText('Save memory note'));
        fireEvent.press(screen.getByLabelText('Save generated memory note'));
        fireEvent.press(screen.getByLabelText('Refresh generated memory note'));
        fireEvent.changeText(screen.getByLabelText('Search local memory'), 'sleep');
        fireEvent.press(screen.getByLabelText('Delete memory Theme: Sleep'));

        await waitFor(() => {
            expect(mockAddNote).toHaveBeenCalledWith('Keep Sundays quiet.');
            expect(mockAddGeneratedNote).toHaveBeenCalledTimes(1);
            expect(mockRemoveAtom).toHaveBeenCalledWith('semantic-1');
        });
        expect(mockRefreshGeneratedNote).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('Work meeting')).toBeNull();
        expect(screen.getByText('Theme: Sleep')).toBeTruthy();
    });

    it('renders an empty state with an entry action', () => {
        mockMemoryState = {
            ...mockMemoryState,
            atoms: [],
            generatedNote: '',
        };

        render(<ExploreScreen />);

        fireEvent.press(screen.getByLabelText('Write your first entry'));

        expect(screen.getByText('Your memory grows as you journal')).toBeTruthy();
        expect(mockPush).toHaveBeenCalledWith('/chat');
    });
});
