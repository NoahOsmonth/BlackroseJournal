/**
 * The picker tells the truth about what it is showing (Kaneo #114).
 *
 * Reported symptom: a user fetched with a Google key and did not see the models
 * they expected. The only way this app could hide a fetched model was the filter
 * words, which used to be applied before the list was saved - so a hidden model
 * left no trace. These tests pin the new contract: the saved list is everything
 * the service sent, and the sheet says how many it is hiding.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ChatModelPickerSheet } from '../../components/ai/ChatModelPickerSheet';

jest.mock('react-native-safe-area-context', () => ({
    ...jest.requireActual('react-native-safe-area-context'),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const MODELS = [
    { id: 'gemini-2.5-pro', name: 'Gemini Pro', contextWindow: 1_000_000 },
    { id: 'gemini-2.5-flash', name: 'Gemini Flash', contextWindow: 1_000_000 },
    { id: 'gateway/antigravity-claude', name: 'Antigravity Claude', contextWindow: 200_000 },
];

function renderSheet(overrides: Record<string, unknown> = {}) {
    return render(
        <ChatModelPickerSheet
            visible
            models={MODELS}
            selectedId={null}
            hasApiKey
            hostLabel="generativelanguage.googleapis.com"
            onSelect={jest.fn()}
            onClose={jest.fn()}
            {...overrides}
        />,
    );
}

describe('model picker visibility', () => {
    it('states how many options it is showing and where they came from', () => {
        renderSheet();
        // The label is one string child by construction, so assert the string.
        const label = screen.getByTestId('model-picker-count').props.children;
        expect(typeof label).toBe('string');
        expect(label).toContain('Showing 3 of 3 options from generativelanguage.googleapis.com');
    });

    it('hides filtered options but says how many, and offers to show them', () => {
        renderSheet({ filterPatterns: ['gemini'], onClearFilter: jest.fn() });
        const label = screen.getByTestId('model-picker-count').props.children;
        expect(label).toContain('Showing 2 of 3 options');
        expect(screen.queryByText('Antigravity Claude')).toBeNull();
        expect(screen.getByTestId('model-picker-clear-filter')).toBeTruthy();
    });

    it('calls the clear action so the rest appear without another fetch', () => {
        const onClearFilter = jest.fn();
        renderSheet({ filterPatterns: ['gemini'], onClearFilter });
        fireEvent.press(screen.getByTestId('model-picker-clear-filter'));
        expect(onClearFilter).toHaveBeenCalledTimes(1);
    });

    it('offers no clear action when nothing is hidden', () => {
        renderSheet({ filterPatterns: [], onClearFilter: jest.fn() });
        expect(screen.queryByTestId('model-picker-clear-filter')).toBeNull();
    });
});
