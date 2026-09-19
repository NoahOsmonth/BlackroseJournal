import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { MemoryLedgerRow } from '../../components/memory/MemoryLedgerRow';
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
    render(<MemoryLedgerRow {...props} />);
    return props;
}

describe('MemoryLedgerRow', () => {
    it('shows the claim and the evidence as different lines', () => {
        setup();
        expect(screen.getByText('Calm mornings help')).toBeTruthy();
        expect(screen.getByText(atom.content)).toBeTruthy();
    });

    it('prints the month only on the first row of a day', () => {
        const { unmount } = render(
            <MemoryLedgerRow atom={atom} onDelete={jest.fn()} onThemePress={jest.fn()} showMonth={false} />,
        );
        expect(screen.queryByText('Sep')).toBeNull();
        unmount();
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
});
