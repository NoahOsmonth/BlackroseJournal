/* eslint-disable import/first */

/**
 * The write-action menu used to be a radial fan of four tiny pills placed on a
 * 100px arc around a zero-height container: labels wrapped, the items overlapped
 * each other, the dock and the journal behind them, and the dimmed scrim was
 * clipped to the pencil's own 44px box.
 *
 * These tests pin the parts of the fix that a screenshot cannot: the stack is
 * anchored above the measured dock, the scrim ignores the release that *ended*
 * the long press (touch retargets it into a click on the scrim, which used to
 * shut the menu the instant the finger lifted), and a real outside press still
 * dismisses.
 */

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { mockReanimated } from '../mocks/reanimatedMock';

jest.mock('react-native-reanimated', () => mockReanimated());

jest.mock('@expo/vector-icons', () => ({ MaterialIcons: () => null }));

jest.mock('@/hooks/theme/use-color-scheme', () => ({ useColorScheme: () => 'dark' }));
jest.mock('@/hooks/theme/useThemeSettings', () => ({
    useThemeSettings: () => ({
        colorTheme: { colors: { accentLight: '#5C564C', accentDark: '#C9C2B6' } },
    }),
}));

import { RadialMenu } from '../../components/journal/radial-menu';

const ANCHOR = 'write-actions-anchor';

function renderMenu(overrides?: {
    isVisible?: boolean;
    onClose?: jest.Mock;
    onNavigate?: jest.Mock;
    anchorOffset?: number;
}) {
    const onClose = overrides?.onClose ?? jest.fn();
    const onNavigate = overrides?.onNavigate ?? jest.fn();
    const utils = render(
        <RadialMenu
            isVisible={overrides?.isVisible ?? true}
            onClose={onClose}
            onNavigate={onNavigate}
            anchorOffset={overrides?.anchorOffset}
        />
    );
    return { ...utils, onClose, onNavigate };
}

describe('RadialMenu write actions', () => {
    it('lists the four write destinations and routes from a row press', () => {
        const { onNavigate } = renderMenu();

        expect(screen.getByLabelText('New entry')).toBeTruthy();
        expect(screen.getByLabelText('New check-in')).toBeTruthy();
        expect(screen.getByLabelText('Ask Rosebud')).toBeTruthy();
        expect(screen.getByLabelText('Memory')).toBeTruthy();

        fireEvent.press(screen.getByLabelText('Memory'));
        expect(onNavigate).toHaveBeenCalledWith('/memory-graph', undefined);

        fireEvent.press(screen.getByLabelText('New check-in'));
        expect(onNavigate).toHaveBeenCalledWith('/intentions/select', undefined);

        fireEvent.press(screen.getByLabelText('New entry'));
        expect(onNavigate).toHaveBeenCalledWith('/chat', { mode: 'new' });
    });

    it('anchors the stack above the dock it was measured against', () => {
        renderMenu({ anchorOffset: 72 });

        const anchor = screen.getByTestId(ANCHOR);
        const style = [anchor.props.style].flat(3).filter(Boolean);
        expect(style).toContainEqual(expect.objectContaining({ bottom: 72 }));
    });

    it('ignores the release that ended the opening long press', () => {
        const { onClose } = renderMenu();

        // Touch retargets the finger-lift into a click on the scrim. No press
        // ever *started* there, so the menu must stay open.
        fireEvent.press(screen.getByLabelText('Close write actions'));

        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByLabelText('Memory')).toBeTruthy();
    });

    it('dismisses when a press starts on the scrim', () => {
        const { onClose } = renderMenu();

        const scrim = screen.getByLabelText('Close write actions');
        fireEvent(scrim, 'pointerDown');
        fireEvent.press(scrim);

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('re-arms the dock after the exit animation, so the next tap writes again', () => {
        jest.useFakeTimers();
        try {
            const onClose = jest.fn();
            const { rerender } = render(
                <RadialMenu isVisible onClose={onClose} onNavigate={jest.fn()} anchorOffset={72} />
            );

            rerender(
                <RadialMenu
                    isVisible={false}
                    onClose={onClose}
                    onNavigate={jest.fn()}
                    anchorOffset={72}
                />
            );
            expect(onClose).not.toHaveBeenCalled();

            act(() => {
                jest.advanceTimersByTime(400);
            });
            expect(onClose).toHaveBeenCalledTimes(1);
        } finally {
            jest.useRealTimers();
        }
    });
});
