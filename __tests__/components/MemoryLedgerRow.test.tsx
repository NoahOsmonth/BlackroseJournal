import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { MemoryLedgerRow } from '../../components/memory/MemoryLedgerRow';
import { BLACKROSE_GRAPH_FAMILIES } from '../../constants/blackrose';
import type { LocalMemoryAtom } from '../../services/memory/localMemory.types';

jest.mock('../../hooks/use-color-scheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: ({ name }: { name: string }) => {
        const React = jest.requireActual('react');
        const { Text } = jest.requireActual('react-native');
        return <Text>{name}</Text>;
    },
}));

const atom: LocalMemoryAtom = {
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
    accessCount: 3,
};

function setup(overrides: Partial<React.ComponentProps<typeof MemoryLedgerRow>> = {}) {
    const props = {
        atom,
        onDelete: jest.fn(),
        onThemePress: jest.fn(),
        onOpen: jest.fn(),
        showMonth: true,
        ...overrides,
    };
    const view = render(<MemoryLedgerRow {...props} />);
    return { ...props, unmount: view.unmount };
}

describe('MemoryLedgerRow', () => {
    it('shows the claim and the evidence as different lines', () => {
        setup();
        const title = screen.getByText('Calm mornings help');
        const body = screen.getByText(atom.content);
        expect(title).toBeTruthy();
        expect(body).toBeTruthy();
        // The whole point of the row replacing the card: the claim and the
        // evidence must not share type. Asserting only that both strings exist
        // passes even when the title is set in the body's own style.
        expect(title.props.className).not.toBe(body.props.className);
        expect(title.props.className).toContain('text-[18px]');
    });

    it('prints the month on the first row of a day and not on a continuation', () => {
        const first = setup();
        expect(screen.getByText('Sep')).toBeTruthy();
        first.unmount();
        // Both directions: a row that never prints the month would otherwise
        // satisfy the negative half alone.
        render(
            <MemoryLedgerRow atom={atom} onDelete={jest.fn()} onThemePress={jest.fn()} showMonth={false} />,
        );
        expect(screen.queryByText('Sep')).toBeNull();
        expect(screen.getByText('19')).toBeTruthy();
    });

    it('opens the entry the note came from', () => {
        const props = setup();
        fireEvent.press(screen.getByLabelText('Open memory Calm mornings help'));
        expect(props.onOpen).toHaveBeenCalledWith(atom);
    });

    it('exposes tag filtering and delete', () => {
        const props = setup();
        fireEvent.press(screen.getByLabelText('Filter memory by mornings'));
        expect(props.onThemePress).toHaveBeenCalledWith('mornings');
        fireEvent.press(screen.getByLabelText('Delete memory Calm mornings help'));
        expect(props.onDelete).toHaveBeenCalledWith(atom);
    });

    it('shows recurrence and provenance rather than raw score bookkeeping', () => {
        setup();
        expect(screen.getByText(/Notes/)).toBeTruthy();
        expect(screen.getByText(/3 revisits/)).toBeTruthy();
    });

    it('says "revisit" rather than "revisits" for a single return', () => {
        setup({ atom: { ...atom, accessCount: 1 } });
        expect(screen.getByText(/1 revisit$/)).toBeTruthy();
    });

    it('keeps the row from swallowing the delete and tag actions as one a11y element', () => {
        // `Pressable` is an accessibility element by default, so without an
        // explicit opt-out a screen reader hears one blob and can never reach
        // the nested buttons. Jest cannot see the platform a11y tree, so pin the
        // prop that decides it.
        setup();
        expect(screen.getByTestId('memory-ledger-row').props.accessible).toBe(false);
    });

    it('colors the layer marker from the light family on paper', () => {
        // The dark note shade on paper is 2.6:1 — under the 3:1 non-text
        // threshold — so a scheme-blind lookup makes the dot read as a smudge.
        setup();
        const dot = screen.getByTestId('memory-ledger-row-layer-dot');
        const style = (Array.isArray(dot.props.style) ? dot.props.style : [dot.props.style]).reduce(
            (acc, entry) => ({ ...acc, ...(entry ?? {}) }),
            {} as { backgroundColor?: string },
        );
        expect(style.backgroundColor).toBe(BLACKROSE_GRAPH_FAMILIES.light.bone.deep);
        expect(style.backgroundColor).not.toBe(BLACKROSE_GRAPH_FAMILIES.dark.bone.deep);
    });
});
