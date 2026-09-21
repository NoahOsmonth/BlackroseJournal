import React from 'react';
import { Alert, ScrollView } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import ExploreScreen from '../../app/(tabs)/explore';
import type { LocalMemoryAtom } from '../../services/memory/localMemory.types';

const mockPush = jest.fn();
const mockGoToTab = jest.fn();
const mockAddExploreNote = jest.fn();
const mockRemoveAtom = jest.fn();
const mockClearAll = jest.fn();

let mockMemoryState: {
    atoms: LocalMemoryAtom[];
    isLoading: boolean;
    refresh: jest.Mock;
    addExploreNote: jest.Mock;
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
        mockAddExploreNote.mockResolvedValue({ failures: [], themes: [] });
        mockRemoveAtom.mockResolvedValue(undefined);
        mockClearAll.mockResolvedValue(undefined);
        mockMemoryState = {
            atoms,
            isLoading: false,
            refresh: jest.fn(),
            addExploreNote: mockAddExploreNote,
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
        expect(screen.getByLabelText('Show All memories')).toBeTruthy();
        expect(mockPush).toHaveBeenCalledWith('/memory-graph');
    });

    it('keeps a line through the composer and filters the ledger', async () => {
        render(<ExploreScreen />);

        // The composer is the page's primary action and is visible on load —
        // no disclosure to open. Its input label is 'New line' (the component's
        // own label), not the old panel's 'Memory note'.
        fireEvent.changeText(screen.getByLabelText('New line'), 'Keep Sundays quiet.');
        fireEvent.press(screen.getByLabelText('Keep this note'));
        fireEvent.changeText(screen.getByLabelText('Search local memory'), 'sleep');
        fireEvent.press(screen.getByLabelText('Delete memory Theme: Sleep'));

        await waitFor(() => {
            expect(mockAddExploreNote).toHaveBeenCalledWith('Keep Sundays quiet.');
            expect(mockRemoveAtom).toHaveBeenCalledWith('semantic-1');
        });
        expect(screen.queryByText('Work meeting')).toBeNull();
        expect(screen.getByText('Theme: Sleep')).toBeTruthy();
    });

    it('reports which stores did not finish, rather than failing silently', async () => {
        // §7: "Entry succeeds, a later store fails → `failures[]` reports which
        // stores failed. Never a silent partial write." The words are already
        // durable at this point, so the alert must say so rather than implying
        // the note was lost.
        mockAddExploreNote.mockResolvedValue({
            failures: [{ store: 'memory file', error: 'quota' }],
            themes: [],
        });
        const alertSpy = jest.spyOn(Alert, 'alert');

        render(<ExploreScreen />);
        fireEvent.changeText(screen.getByLabelText('New line'), 'Keep Sundays quiet.');
        fireEvent.press(screen.getByLabelText('Keep this note'));

        await waitFor(() => {
            expect(alertSpy).toHaveBeenCalledWith(
                'Saved, with a gap',
                expect.stringContaining('memory file'),
            );
        });
        // The gap must not be reported as a total failure: no error alert.
        expect(alertSpy).not.toHaveBeenCalledWith(
            'Could not keep the note',
            expect.anything(),
        );
    });

    it('surfaces a total write failure as an error instead of a gap', async () => {
        mockAddExploreNote.mockRejectedValue(new Error('disk full'));
        const alertSpy = jest.spyOn(Alert, 'alert');

        render(<ExploreScreen />);
        fireEvent.changeText(screen.getByLabelText('New line'), 'Keep Sundays quiet.');
        fireEvent.press(screen.getByLabelText('Keep this note'));

        await waitFor(() => {
            expect(alertSpy).toHaveBeenCalledWith('Could not keep the note', 'disk full');
        });
    });

    it('shows no fake-AI suggestion panel', () => {
        render(<ExploreScreen />);

        expect(screen.queryByText(/Blackrose noticed/)).toBeNull();
        expect(screen.queryByText(/Keep this as a note/)).toBeNull();
        expect(screen.queryByText(/No stable pattern yet/)).toBeNull();
    });

    it('paginates memory atoms instead of rendering an unbounded list', () => {
        const manyAtoms: LocalMemoryAtom[] = Array.from({ length: 12 }, (_, index) => ({
            id: `atom-${index}`,
            layer: 'episodic',
            source: 'journal',
            title: `Memory ${index}`,
            content: `Content for memory ${index}`,
            tags: [],
            salience: 0.5,
            confidence: 0.5,
            createdAt: index,
            updatedAt: index,
            accessCount: 0,
        }));
        mockMemoryState = {
            ...mockMemoryState,
            atoms: manyAtoms,
        };

        render(<ExploreScreen />);

        expect(screen.getByText('Memory 0')).toBeTruthy();
        expect(screen.getByText('Memory 7')).toBeTruthy();
        expect(screen.queryByText('Memory 8')).toBeNull();
        fireEvent.press(screen.getByLabelText('Show 4 more memories'));
        expect(screen.getByText('Memory 8')).toBeTruthy();
        expect(screen.getByText('Memory 11')).toBeTruthy();
    });

    it('renders an empty state whose action stays on this page', () => {
        mockMemoryState = {
            ...mockMemoryState,
            atoms: [],
        };

        render(<ExploreScreen />);

        expect(screen.getByText('Still quiet here')).toBeTruthy();

        // The hub scrolls its own scroller to the composer, so the action has a
        // positive half as well as the negative one below. `ScrollView` here is
        // the class the mocked scroller extends, so the spy sees the real call
        // the hub makes through its ref. `y` is not asserted: `onLayout` never
        // fires under Jest, so the measured composer offset is still 0.
        const scrollSpy = jest.spyOn(ScrollView.prototype as unknown as {
            scrollTo: (...args: unknown[]) => void;
        }, 'scrollTo');
        fireEvent.press(screen.getByLabelText('Write a line'));
        expect(scrollSpy).toHaveBeenCalled();

        // The empty state's action brings the composer into view; it must not
        // navigate away (the old behaviour routed to /chat).
        expect(screen.getByLabelText('New line')).toBeTruthy();
        expect(mockPush).not.toHaveBeenCalledWith('/chat');
    });

    it('opens a navigable memory atom source when provenance exists', () => {
        mockMemoryState = {
            ...mockMemoryState,
            atoms: [{
                ...atoms[2],
                rootSourceId: 'entry-99',
                rootSourceKind: 'journal_entry',
            }],
        };

        render(<ExploreScreen />);
        fireEvent.press(screen.getByLabelText('Open memory Work meeting'));
        expect(mockPush).toHaveBeenCalledWith({
            pathname: '/entry-detail',
            params: { id: 'entry-99' },
        });
    });
});

