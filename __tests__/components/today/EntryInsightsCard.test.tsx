/* eslint-disable import/first */

/**
 * The insight's overflow actions used to be a bottom-sheet modal. The backdrop
 * was not the bug — it was full-bleed and it did dismiss. The sheet's own inert
 * area was: a header band, side gutters, inter-row gaps and the ~58pt band under
 * the last row (exactly where the thumb rests) did nothing, so a tap meant as
 * "outside" landed on the sheet and the reliable exit became "find Cancel". In
 * dark mode the scrim also composited to ~1.03 contrast against the void, so
 * nothing showed where the sheet stopped.
 *
 * These tests pin the replacement: the actions are a state of the card. The
 * trigger toggles, each action dismisses on the press that chose it, and the card
 * body closes instead of navigating.
 *
 * Touch geometry is asserted by compiling the real class names — see
 * `__tests__/mocks/tailwindCompile.ts` for why `props.style` cannot show it.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { mockReanimated } from '../../mocks/reanimatedMock';

jest.mock('react-native-reanimated', () => mockReanimated());
jest.mock('@expo/vector-icons/MaterialIcons', () => ({ __esModule: true, default: () => null }));
jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => 'light' }));

import { compileTailwind, mergeBox } from '../../mocks/tailwindCompile';
import { EntryInsightsCard } from '../../../components/today/EntryInsightsCard';

const QUESTION = 'What would make tomorrow feel 10% lighter?';
const ACTIONS = ['Share', 'Copy', 'Saved insights', 'Hide for today'] as const;
const TOUCH_FLOOR = 44;

function renderCard(
    onPress: jest.Mock = jest.fn(),
    overrides: Partial<React.ComponentProps<typeof EntryInsightsCard>> = {}
) {
    const handlers = {
        onRefresh: jest.fn(),
        onBookmark: jest.fn(),
        onShare: jest.fn(),
        onCopy: jest.fn(),
        onHide: jest.fn(),
        onShowSavedInsights: jest.fn(),
        onPress,
    };
    render(<EntryInsightsCard question={QUESTION} {...handlers} {...overrides} />);
    return handlers;
}

const trigger = () => screen.getByLabelText('More options');

describe('EntryInsightsCard action dock', () => {
    beforeEach(() => jest.clearAllMocks());

    it('renders the question and the three resting controls', () => {
        renderCard();

        expect(screen.getByText('Based on your entries')).toBeTruthy();
        expect(screen.getByText(QUESTION)).toBeTruthy();
        expect(screen.getByLabelText('Open insight conversation')).toBeTruthy();
        expect(screen.getByLabelText('Refresh insight')).toBeTruthy();
        expect(screen.getByLabelText('Save insight')).toBeTruthy();
        expect(trigger()).toBeTruthy();
    });

    it('keeps the actions out of the tree until the trigger is pressed', () => {
        renderCard();

        ACTIONS.forEach((label) => expect(screen.queryByLabelText(label)).toBeNull());
        expect(screen.queryByLabelText('Cancel')).toBeNull();
    });

    it('opens all four actions from the trigger', () => {
        renderCard();

        fireEvent.press(trigger());

        ACTIONS.forEach((label) => expect(screen.getByLabelText(label)).toBeTruthy());
    });

    it('reports the trigger as expanded only while the dock is open', () => {
        renderCard();

        expect(trigger().props.accessibilityState?.expanded).toBe(false);

        fireEvent.press(trigger());
        expect(trigger().props.accessibilityState?.expanded).toBe(true);

        fireEvent.press(trigger());
        expect(trigger().props.accessibilityState?.expanded).toBe(false);
    });

    it('reports every dock transition so the screen can keep it above the nav', () => {
        const onDockOpenChange = jest.fn();
        renderCard(jest.fn(), { onDockOpenChange });

        fireEvent.press(trigger());
        expect(onDockOpenChange).toHaveBeenLastCalledWith(true);

        fireEvent.press(trigger());
        expect(onDockOpenChange).toHaveBeenLastCalledWith(false);

        fireEvent.press(trigger());
        fireEvent.press(screen.getByLabelText('Hide for today'));
        expect(onDockOpenChange).toHaveBeenLastCalledWith(false);
    });

    it('toggles the dock closed when the trigger is pressed again', () => {
        renderCard();

        fireEvent.press(trigger());
        fireEvent.press(trigger());

        ACTIONS.forEach((label) => expect(screen.queryByLabelText(label)).toBeNull());
    });

    it.each([
        ['Share', 'onShare'],
        ['Copy', 'onCopy'],
        ['Saved insights', 'onShowSavedInsights'],
        ['Hide for today', 'onHide'],
    ])('runs %s and closes the dock in the same press', (label, handler) => {
        const handlers = renderCard();
        fireEvent.press(trigger());

        fireEvent.press(screen.getByLabelText(label));

        expect(handlers[handler as keyof typeof handlers]).toHaveBeenCalledTimes(1);
        ACTIONS.forEach((name) => expect(screen.queryByLabelText(name)).toBeNull());
        expect(handlers.onPress).not.toHaveBeenCalled();
    });

    it('dismisses on a card-body press instead of navigating', () => {
        const { onPress } = renderCard();
        fireEvent.press(trigger());

        fireEvent.press(screen.getByLabelText('Open insight conversation'));

        expect(onPress).not.toHaveBeenCalled();
        expect(screen.queryByLabelText('Share')).toBeNull();
    });

    it('navigates from the question once the dock is closed', () => {
        const { onPress } = renderCard();
        fireEvent.press(trigger());
        fireEvent.press(trigger());

        fireEvent.press(screen.getByLabelText('Open insight conversation'));

        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('closes the dock when a resting control runs', () => {
        const { onRefresh, onBookmark } = renderCard();
        fireEvent.press(trigger());

        fireEvent.press(screen.getByLabelText('Refresh insight'));

        expect(onRefresh).toHaveBeenCalledTimes(1);
        expect(screen.queryByLabelText('Share')).toBeNull();

        fireEvent.press(trigger());
        fireEvent.press(screen.getByLabelText('Save insight'));

        expect(onBookmark).toHaveBeenCalledTimes(1);
        expect(screen.queryByLabelText('Share')).toBeNull();
    });

    it('disables the question as a link when onPress is omitted', () => {
        render(
            <EntryInsightsCard
                question="No destination"
                onRefresh={jest.fn()}
                onBookmark={jest.fn()}
                onShare={jest.fn()}
                onCopy={jest.fn()}
                onHide={jest.fn()}
                onShowSavedInsights={jest.fn()}
            />
        );

        expect(
            screen.getByLabelText('Open insight conversation').props.accessibilityState?.disabled
        ).toBe(true);
    });

    it('keeps the resting icon controls at or above the 44pt floor on native', async () => {
        const boxes = await compileTailwind('components/today/EntryInsightsCard.tsx');
        renderCard();

        for (const label of ['Refresh insight', 'Save insight', 'More options']) {
            const box = mergeBox(boxes, String(screen.getByLabelText(label).props.className));
            expect({ label, height: box.height, width: box.width }).toEqual({
                label,
                height: TOUCH_FLOOR,
                width: TOUCH_FLOOR,
            });
        }
    });
});
