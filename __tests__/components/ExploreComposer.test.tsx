import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ExploreComposer } from '../../components/memory/ExploreComposer';
import { BLACKROSE_PALETTE } from '../../constants/theme';

jest.mock('../../hooks/use-color-scheme', () => ({ useColorScheme: () => 'light' }));

const NOW = Date.UTC(2026, 8, 19, 10, 0, 0);

function setup(overrides: Partial<React.ComponentProps<typeof ExploreComposer>> = {}) {
    const props = {
        value: '',
        onChangeText: jest.fn(),
        onKeep: jest.fn(),
        isSaving: false,
        now: NOW,
        ...overrides,
    };
    render(<ExploreComposer {...props} />);
    return props;
}

describe('ExploreComposer', () => {
    it('offers Keep only once there is something to keep', () => {
        setup();
        expect(screen.getByLabelText('Keep this note').props.accessibilityState.disabled).toBe(true);
    });

    it('previews the themes the note will actually be filed under', () => {
        setup({ value: 'Calm mornings help me think about mornings.' });
        expect(screen.getByText(/Filed under/)).toBeTruthy();
        // Title-case, matching the portrait chips — the extraction token is
        // "mornings", the rendered theme is "Mornings".
        expect(screen.getByText(/Mornings/)).toBeTruthy();
        expect(screen.queryByText(/mornings/)).toBeNull();
    });

    it('says so instead of inventing an observation when nothing is recognised', () => {
        setup({ value: 'it was a day' });
        expect(screen.getByText(/Nothing recognised/)).toBeTruthy();
    });

    it('never blocks keeping a note it could not file', () => {
        setup({ value: 'it was a day' });
        expect(screen.getByLabelText('Keep this note').props.accessibilityState.disabled).toBe(false);
    });

    it('calls onKeep when pressed', () => {
        const props = setup({ value: 'The kiln needs a new element.' });
        fireEvent.press(screen.getByLabelText('Keep this note'));
        expect(props.onKeep).toHaveBeenCalledTimes(1);
    });

    it('disables Keep while a save is in flight', () => {
        setup({ value: 'The kiln needs a new element.', isSaving: true });
        expect(screen.getByLabelText('Keep this note').props.accessibilityState.disabled).toBe(true);
    });

    it('offers no Refresh and no generated-suggestion action', () => {
        setup({ value: 'Calm mornings help.' });
        expect(screen.queryByText(/Refresh/)).toBeNull();
        expect(screen.queryByText(/Keep this as a note/)).toBeNull();
        expect(screen.queryByText(/Blackrose noticed/)).toBeNull();
    });

    it('states the privacy promise beside the commit action', () => {
        // The on-screen restatement of the no-AI / no-network commitment — it is
        // load-bearing copy, not decoration.
        setup({ value: 'The kiln needs a new element.' });
        expect(screen.getByText('Stays on this device.')).toBeTruthy();
        expect(screen.getByText('Keep it')).toBeTruthy();
    });

    it('labels the input with its visible label and announces the preview', () => {
        setup({ value: 'Calm mornings help.' });
        expect(screen.getByLabelText('New line')).toBeTruthy();
        // A screen-reader user must hear the themes update, and hear the
        // "nothing recognised" branch rather than silence.
        const themes = screen.getByText('Calm · Mornings · Help');
        expect(themes.props.accessibilityLiveRegion).toBe('polite');
    });

    it('previews themes from the same clipped text the write path will file', () => {
        // A token past the 600-char cut must NOT be previewed, because the file
        // will not carry it — the preview and the write path must agree.
        // Case-insensitive: the preview is title-cased, so a case-sensitive
        // query would pass even with the raw value and stop discriminating.
        const long = `${'alpha '.repeat(110)}zebraquix`.trim();
        setup({ value: long });
        expect(screen.getByText(/alpha/i)).toBeTruthy();
        expect(screen.queryByText(/zebraquix/i)).toBeNull();
    });

    it('fills the commit action with the high-contrast CTA accent, not the bone accent', () => {
        // The prototype's `.write-keep` fills with `--accent-strong` and the plan
        // calls that token "Primary CTA fill contrast". `bone-*` is the
        // *interactive* accent and is a visibly lighter mark; using it here was a
        // real defect, so pin the fill rather than trusting the class name.
        setup({ value: 'The kiln needs a new element.' });
        const fill = screen.getByLabelText('Keep this note').props.style;
        const resolved = (Array.isArray(fill) ? fill : [fill]).reduce(
            (acc, entry) => ({ ...acc, ...(entry ?? {}) }),
            {} as { backgroundColor?: string },
        );
        expect(resolved.backgroundColor).toBe(BLACKROSE_PALETTE.light.accentStrong);
        expect(resolved.backgroundColor).not.toBe(BLACKROSE_PALETTE.light.accent);
    });
});
