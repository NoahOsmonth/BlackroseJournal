import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeDriftStrip } from '../../components/memory/ThemeDriftStrip';

jest.mock('../../hooks/use-color-scheme', () => ({ useColorScheme: () => 'light' }));

const THEMES = ['mornings', 'calm', 'work'];

describe('ThemeDriftStrip', () => {
    it('renders one focusable run and inert repeats', () => {
        render(<ThemeDriftStrip themes={THEMES} onThemePress={jest.fn()} />);
        // One button per theme — the repeats exist to make the offset periodic,
        // and a focusable element inside a duplicated run is a focus trap.
        expect(screen.getAllByRole('button')).toHaveLength(THEMES.length);
    });

    it('filters by theme when a word is pressed', () => {
        const onThemePress = jest.fn();
        render(<ThemeDriftStrip themes={THEMES} onThemePress={onThemePress} />);
        fireEvent.press(screen.getAllByLabelText('Filter memory by calm')[0]!);
        expect(onThemePress).toHaveBeenCalledWith('calm');
    });

    it('labels the group for assistive tech', () => {
        render(<ThemeDriftStrip themes={THEMES} onThemePress={jest.fn()} />);
        expect(screen.getByLabelText('Themes you return to')).toBeTruthy();
    });

    it('renders nothing when there are no themes', () => {
        const { toJSON } = render(<ThemeDriftStrip themes={[]} onThemePress={jest.fn()} />);
        expect(toJSON()).toBeNull();
    });

    it('keeps the strip from collapsing its words into one accessibility element', () => {
        // An `accessible` container groups every descendant into a single a11y
        // element, so the three theme buttons stop being reachable on their own.
        // Jest cannot see the platform a11y tree — RNTL still reports all three
        // buttons under a broken parent — so pin the prop that decides it.
        render(<ThemeDriftStrip themes={THEMES} onThemePress={jest.fn()} />);
        expect(screen.getByTestId('theme-drift-strip').props.accessible).toBeFalsy();
    });

    it('separates the words with the prototype dot', () => {
        // The separator is part of the periodic content: it is what makes one
        // run's width equal the wrap distance and keeps the seam from reading as
        // two words colliding. Dropping it is invisible to every other assertion.
        render(<ThemeDriftStrip themes={THEMES} onThemePress={jest.fn()} />);
        expect(screen.getAllByText('·').length).toBeGreaterThanOrEqual(THEMES.length);
    });
});
