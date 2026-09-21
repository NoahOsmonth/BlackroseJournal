import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';

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

/** Two notes on different days of the *same* month, in ledger order. */
const sameMonthAtoms: LocalMemoryAtom[] = [
    {
        ...atoms[0],
        id: 'note-late',
        title: 'Later in the month',
        createdAt: Date.UTC(2026, 8, 19, 10, 0, 0),
        updatedAt: Date.UTC(2026, 8, 19, 10, 0, 0),
    },
    {
        ...atoms[0],
        id: 'note-early',
        title: 'Earlier in the month',
        createdAt: Date.UTC(2026, 8, 12, 10, 0, 0),
        updatedAt: Date.UTC(2026, 8, 12, 10, 0, 0),
    },
];

/**
 * Index of the first node matching `predicate` in render order. The composer's
 * leading position is a *structural* requirement of the port, and presence alone
 * cannot see it — a screen with the composer at the bottom passed every other
 * assertion in this file.
 */
function renderIndex(predicate: (props: Record<string, unknown>) => boolean): number {
    return screen.UNSAFE_root
        .findAll(() => true)
        .findIndex((node) => predicate(node.props as Record<string, unknown>));
}

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

        // Presence is not order. The task's central structural requirement is
        // that the composer *leads* the page — before the portrait, the filter
        // line, the "Written" list head and the first ledger row. Asserting only
        // that the input exists passed with the composer moved to the bottom of
        // the page, so compare render positions instead.
        const composer = renderIndex((props) => props.accessibilityLabel === 'New line');
        expect(composer).toBeGreaterThanOrEqual(0);

        expect(renderIndex((props) => props.testID === 'memory-ledger-row')).toBeGreaterThan(composer);
        expect(renderIndex((props) => props.children === 'About you')).toBeGreaterThan(composer);
        expect(renderIndex((props) => props.children === 'Written')).toBeGreaterThan(composer);
        // The filter line's first segment ("All") stands in for the whole row.
        expect(renderIndex((props) => props.children === 'All')).toBeGreaterThan(composer);
    });

    it('prints the month on every new day, not just a new month', () => {
        // Two notes on Sep 19 and Sep 12: the second is a new *day*, so it opens
        // its own date block and must print its month. Suppressing it because
        // the month already appeared above inverts the ledger convention.
        mockAtoms = sameMonthAtoms;
        render(<MemoryHubScreen />);

        const rows = screen.getAllByTestId('memory-ledger-row');
        expect(rows).toHaveLength(2);
        // Scoped to the rows: the composer's own date column also prints the
        // current month, so a screen-wide count would not be about the ledger.
        expect(within(rows[0]!).getByText('Sep')).toBeTruthy();
        expect(within(rows[1]!).getByText('Sep')).toBeTruthy();
        expect(within(rows[0]!).getByText('19')).toBeTruthy();
        expect(within(rows[1]!).getByText('12')).toBeTruthy();
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
        // The block's own label must describe what is here now. It previously
        // promised "Your memory grows as you journal" — a sentence the visible
        // copy no longer makes, since the action keeps you on this page.
        expect(screen.getByLabelText(/write a line to start it/i)).toBeTruthy();
        expect(screen.queryByLabelText('Your memory grows as you journal')).toBeNull();
    });
});
