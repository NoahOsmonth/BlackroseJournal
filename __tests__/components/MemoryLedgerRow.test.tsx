import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { MemoryLedgerRow } from '../../components/memory/MemoryLedgerRow';
import { formatLedgerDate } from '../../components/memory/memoryDisplay';
import { BLACKROSE_GRAPH_FAMILIES, BLACKROSE_PALETTE } from '../../constants/blackrose';
import type { LocalMemoryAtom } from '../../services/memory/localMemory.types';
import { getLocalDateKey } from '../../utils/date';

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

/**
 * The day-of-month the row will print for a timestamp, read through the same
 * helper the row renders with. `formatLedgerDate` reads it off the device clock
 * (`new Date(timestamp).getDate()`), so a hard-coded literal only holds in the
 * runner's own timezone: the Sep 19 UTC fixture renders as "20" under UTC+14.
 * Deriving it keeps the assertion about the row's own output, not the CI box.
 */
function localDay(timestamp: number): string {
    return formatLedgerDate(timestamp).day;
}

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
        expect(screen.getByText(localDay(atom.createdAt))).toBeTruthy();
    });

    it('inks the day number on a day start and mutes a continuation', () => {
        // The month-drop makes a day boundary findable; the ink change is what
        // does the finding, so both halves are asserted. Muted by default...
        const continuation = setup({ showMonth: false });
        expect(screen.getByTestId('memory-ledger-row-day').props.className)
            .toContain('text-text-secondary-light');
        continuation.unmount();

        // ...inked when this row opens a new day.
        setup({ showMonth: true });
        const day = screen.getByTestId('memory-ledger-row-day');
        expect(day.props.className).toContain('text-text-light');
        expect(day.props.className).not.toContain('text-text-secondary-light');
    });

    it('draws today\'s accent rule and inks the day, and draws neither on an older day', () => {
        const todayAtom: LocalMemoryAtom = { ...atom, createdAt: Date.now(), updatedAt: Date.now() };
        const today = setup({ atom: todayAtom, showMonth: false });
        expect(screen.getByTestId('memory-ledger-row-today-rule')).toBeTruthy();
        // Today inks even as a continuation — the day number must not be muted.
        expect(screen.getByText(String(new Date().getDate())).props.className)
            .toContain('text-text-light');
        today.unmount();

        // The fixture is Sep 19 2026, not today: no rule, and the muted class
        // when it is also not a day start.
        setup({ showMonth: false });
        expect(screen.queryByTestId('memory-ledger-row-today-rule')).toBeNull();
    });

    it('fills today\'s rule with the scheme-aware bone accent', () => {
        const todayAtom: LocalMemoryAtom = { ...atom, createdAt: Date.now(), updatedAt: Date.now() };
        setup({ atom: todayAtom });
        const rule = screen.getByTestId('memory-ledger-row-today-rule');
        const style = (Array.isArray(rule.props.style) ? rule.props.style : [rule.props.style]).reduce(
            (acc, entry) => ({ ...acc, ...(entry ?? {}) }),
            {} as { backgroundColor?: string },
        );
        // The mocked scheme is light, so the paper accent — not the dark one.
        expect(style.backgroundColor).toBe(BLACKROSE_PALETTE.light.accent);
        expect(style.backgroundColor).not.toBe(BLACKROSE_PALETTE.dark.accent);
        expect(getLocalDateKey(new Date(todayAtom.createdAt))).toBe(getLocalDateKey());
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
