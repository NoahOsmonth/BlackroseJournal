import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ExploreComposer } from '../../components/memory/ExploreComposer';

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
        expect(screen.getByText(/mornings/)).toBeTruthy();
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

    it('previews themes from the same clipped text the write path will file', () => {
        // A token past the 600-char cut must NOT be previewed, because the file
        // will not carry it — the preview and the write path must agree.
        const long = `${'alpha '.repeat(110)}zebraquix`.trim();
        setup({ value: long });
        const preview = screen.getByText(/alpha/);
        expect(preview).toBeTruthy();
        expect(screen.queryByText(/zebraquix/)).toBeNull();
    });
});
