import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { MemoryHubScreen } from '../../components/memory/MemoryHubScreen';
import type { LocalMemoryAtom } from '../../services/memory/localMemory.types';

jest.mock('../../hooks/use-color-scheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('../../hooks/navigation/useTabNavigation', () => ({
    useTabNavigation: () => ({ goToTab: jest.fn() }),
}));
jest.mock('../../components/journal', () => ({ BottomNav: () => null }));
// The brief's snippet omits this, but the screen reads `useSafeAreaInsets`
// through `ScreenContainer`; without it every render throws before any
// assertion runs. Same mock as __tests__/screens/ExploreScreen.test.tsx.
jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: { children: React.ReactNode }) => {
        const { View } = jest.requireActual('react-native');
        return <View>{children}</View>;
    },
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: ({ name }: { name: string }) => {
        const React = jest.requireActual('react');
        const { Text } = jest.requireActual('react-native');
        return <Text>{name}</Text>;
    },
}));

// `mock`-prefixed so babel's jest.mock hoisting lets the factory close over it.
const mockAddExploreNote = jest.fn().mockResolvedValue({ failures: [], themes: [] });
// Mutable so a test can render the screen with atoms present. With an empty
// store the deleted panel never rendered at all, so a "no fake AI panel"
// assertion would pass vacuously against the pre-port screen.
let mockAtoms: LocalMemoryAtom[] = [];

jest.mock('../../hooks/memory/useLocalMemories', () => ({
    useLocalMemories: () => ({
        atoms: mockAtoms,
        isLoading: false,
        refresh: jest.fn(),
        addExploreNote: mockAddExploreNote,
        removeAtom: jest.fn(),
        clearAll: jest.fn(),
    }),
}));

const atoms: LocalMemoryAtom[] = [
    {
        id: 'note-1',
        layer: 'note',
        source: 'manual',
        sourceId: 'entry_1',
        rootSourceId: 'entry_1',
        rootSourceKind: 'journal_entry',
        title: 'Calm mornings help',
        content: 'Calm mornings help me think straight about the work.',
        tags: ['mornings', 'calm'],
        salience: 0.9,
        confidence: 1,
        createdAt: Date.UTC(2026, 8, 19, 10, 0, 0),
        updatedAt: Date.UTC(2026, 8, 19, 10, 0, 0),
        accessCount: 0,
    },
];

describe('MemoryHubScreen', () => {
    beforeEach(() => {
        mockAtoms = atoms;
        mockAddExploreNote.mockClear();
        mockAddExploreNote.mockResolvedValue({ failures: [], themes: [] });
    });

    it('leads with the composer', () => {
        render(<MemoryHubScreen />);
        // The composer's input label is 'New line' (ExploreComposer.tsx:81),
        // matching its visible label at :64 — not 'New note'.
        expect(screen.getByLabelText('New line')).toBeTruthy();
    });

    it('keeps a note through the shared write path and clears the input', async () => {
        render(<MemoryHubScreen />);
        fireEvent.changeText(screen.getByLabelText('New line'), 'Calm mornings help.');
        fireEvent.press(screen.getByLabelText('Keep this note'));

        await waitFor(() => expect(mockAddExploreNote).toHaveBeenCalledWith('Calm mornings help.'));
        await waitFor(() => expect(screen.getByLabelText('New line').props.value).toBe(''));
    });

    it('keeps the graph affordance the dark-mode guard asserts on', () => {
        render(<MemoryHubScreen />);
        expect(screen.getByText('Open graph')).toBeTruthy();
    });

    it('shows no fake AI panel', () => {
        render(<MemoryHubScreen />);
        expect(screen.queryByText(/Blackrose noticed/)).toBeNull();
        expect(screen.queryByText(/Keep this as a note/)).toBeNull();
        expect(screen.queryByText(/Refresh/)).toBeNull();
    });

    it('lists memories as ledger rows rather than cards', () => {
        render(<MemoryHubScreen />);
        expect(screen.getByText('Calm mornings help')).toBeTruthy();
        expect(screen.getAllByTestId('memory-ledger-row')).toHaveLength(1);
    });

    it('points the empty state at the composer instead of routing to chat', () => {
        mockAtoms = [];
        render(<MemoryHubScreen />);
        expect(screen.getByText('Nothing is kept yet. Write a line above and it stays — here and in your archive.')).toBeTruthy();
        // The composer is still on the page above the empty state — the empty
        // state's action must reach it, not navigate away.
        expect(screen.getByLabelText('New line')).toBeTruthy();
        expect(screen.getByLabelText('Write a line')).toBeTruthy();
    });
});
