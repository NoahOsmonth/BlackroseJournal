/* eslint-disable import/first */

/**
 * The dock replaced a modal whose rows were all one colour and 42pt tall: "Hide
 * for today" was byte-identical to "Copy", and the tap targets only cleared the
 * floor on the web build. Both are pinned here.
 *
 * Geometry comes from compiling the real class names rather than reading
 * `props.style`, which is undefined in this jest environment — and the compile
 * uses `inlineRem = 14`, the value native actually runs with, so a rem-based
 * utility substituted for `min-h-[56px]` fails here instead of shipping a target
 * that is 8pt short.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

jest.mock('@expo/vector-icons/MaterialIcons', () => ({ __esModule: true, default: () => null }));
jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => 'light' }));

import { compileTailwind, mergeBox } from '../../mocks/tailwindCompile';
import { InsightActionDock } from '../../../components/today/InsightActionDock';

const TOUCH_FLOOR = 44;

function renderDock() {
    const handlers = {
        onShare: jest.fn(),
        onCopy: jest.fn(),
        onShowSavedInsights: jest.fn(),
        onHide: jest.fn(),
        onDismiss: jest.fn(),
    };
    render(<InsightActionDock {...handlers} />);
    return handlers;
}

describe('InsightActionDock', () => {
    beforeEach(() => jest.clearAllMocks());

    it('offers the four actions and no Cancel row', () => {
        renderDock();

        ['Share', 'Copy', 'Saved insights', 'Hide for today'].forEach((label) =>
            expect(screen.getByLabelText(label)).toBeTruthy()
        );
        expect(screen.queryByLabelText('Cancel')).toBeNull();
    });

    it('routes each action to its own handler', () => {
        const handlers = renderDock();

        fireEvent.press(screen.getByLabelText('Share'));
        expect(handlers.onShare).toHaveBeenCalledTimes(1);

        fireEvent.press(screen.getByLabelText('Copy'));
        expect(handlers.onCopy).toHaveBeenCalledTimes(1);

        fireEvent.press(screen.getByLabelText('Saved insights'));
        expect(handlers.onShowSavedInsights).toHaveBeenCalledTimes(1);

        fireEvent.press(screen.getByLabelText('Hide for today'));
        expect(handlers.onHide).toHaveBeenCalledTimes(1);
    });

    it('dismisses on a press that is not on an action', () => {
        const handlers = renderDock();

        fireEvent.press(screen.getByRole('menu'));

        expect(handlers.onDismiss).toHaveBeenCalledTimes(1);
        expect(handlers.onShare).not.toHaveBeenCalled();
        expect(handlers.onHide).not.toHaveBeenCalled();
    });

    it('tints only the destructive action with the danger token', () => {
        renderDock();

        const destructive = screen.getByText('Hide for today');
        expect(String(destructive.props.className)).toContain('text-danger-light');
        expect(String(destructive.props.className)).toContain('dark:text-danger-dark');

        for (const label of ['Share', 'Copy', 'Saved insights']) {
            const className = String(screen.getByText(label).props.className);
            expect({ label, danger: className.includes('danger') }).toEqual({
                label,
                danger: false,
            });
        }
    });

    it('gives every action a full-width column at or above the 44pt floor on native', async () => {
        const boxes = await compileTailwind('components/today/InsightActionDock.tsx');
        renderDock();

        for (const label of ['Share', 'Copy', 'Saved insights', 'Hide for today']) {
            const box = mergeBox(boxes, String(screen.getByLabelText(label).props.className));
            // Height is declared as a minimum; width comes from `flex-1` across the
            // card, which at the native inlineRem of 14 costs 21pt of gutter and
            // 10.5pt of gaps and still leaves a 77pt column at a 390pt screen (60pt
            // at 320pt) — both clear the floor, so the column only has to stay
            // `flex-1`.
            expect({
                label,
                clearsFloor: Number(box.minHeight) >= TOUCH_FLOOR,
                flexGrow: box.flexGrow,
            }).toEqual({ label, clearsFloor: true, flexGrow: 1 });
        }
    });
});
