import React from 'react';
import { render } from '@testing-library/react-native';

import {
    RANGE_SLIDER_GROOVE_HEIGHT,
    RANGE_SLIDER_HIT_HEIGHT,
    RANGE_SLIDER_THUMB_SIZE,
    RANGE_SLIDER_THUMB_WIDTH,
    RangeSlider,
    roundToStep,
} from '@/components/ui/RangeSlider';
import { TintColors } from '@/constants/theme';

jest.mock('expo-haptics', () => ({
    selectionAsync: jest.fn(() => Promise.resolve()),
    impactAsync: jest.fn(() => Promise.resolve()),
    ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}));

jest.mock('@/hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

describe('roundToStep', () => {
    it('snaps to step boundaries without float noise', () => {
        expect(roundToStep(0.34, 0.1, 0, 2)).toBe(0.3);
        expect(roundToStep(0.97, 0.05, 0, 1)).toBe(0.95);
        expect(roundToStep(1.04, 0.05, 0, 1)).toBe(1);
        expect(roundToStep(2.5, 0.1, 0, 2)).toBe(2);
        expect(roundToStep(-1, 0.1, 0, 2)).toBe(0);
    });

    it('covers temperature-style 0.1 steps across 0–2', () => {
        expect(roundToStep(0.75, 0.1, 0, 2)).toBe(0.8);
        expect(roundToStep(1.24, 0.1, 0, 2)).toBe(1.2);
    });
});

describe('RangeSlider', () => {
    it('renders as an adjustable control with the given label', () => {
        const { getByLabelText } = render(
            <RangeSlider
                value={0.95}
                min={0}
                max={1}
                step={0.05}
                onChange={jest.fn()}
                accessibilityLabel="Top-P"
            />
        );

        const slider = getByLabelText('Top-P');
        expect(slider.props.accessibilityRole).toBe('adjustable');
        expect(slider.props.accessibilityValue).toEqual(
            expect.objectContaining({ min: 0, max: 1, now: 0.95, text: '0.95' })
        );
    });

    it('exposes increment and decrement accessibility actions', () => {
        const { getByLabelText } = render(
            <RangeSlider
                value={1}
                min={0}
                max={2}
                step={0.1}
                onChange={jest.fn()}
                accessibilityLabel="Temperature"
            />
        );

        const slider = getByLabelText('Temperature');
        expect(slider.props.accessibilityActions).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ name: 'increment' }),
                expect.objectContaining({ name: 'decrement' }),
            ])
        );
    });

    it('increments via accessibility action and commits the stepped value', () => {
        const onChange = jest.fn();
        const onSliding = jest.fn();
        const { getByLabelText } = render(
            <RangeSlider
                value={0.5}
                min={0}
                max={1}
                step={0.1}
                onChange={onChange}
                onSliding={onSliding}
                accessibilityLabel="Top-P"
            />
        );

        getByLabelText('Top-P').props.onAccessibilityAction({
            nativeEvent: { actionName: 'increment' },
        });

        expect(onSliding).toHaveBeenCalledWith(0.6);
        expect(onChange).toHaveBeenCalledWith(0.6);
    });

    it('decrements via accessibility action at default-ish values', () => {
        const onChange = jest.fn();
        const { getByLabelText } = render(
            <RangeSlider
                value={1}
                min={0}
                max={2}
                step={0.1}
                onChange={onChange}
                accessibilityLabel="Temperature"
            />
        );

        getByLabelText('Temperature').props.onAccessibilityAction({
            nativeEvent: { actionName: 'decrement' },
        });

        expect(onChange).toHaveBeenCalledWith(0.9);
    });

    it('paints precision-instrument parts: thin groove, range, circular thumb, ticks', () => {
        const { getByTestId, queryByTestId } = render(
            <RangeSlider
                value={1}
                min={0}
                max={2}
                step={0.1}
                onChange={jest.fn()}
                accessibilityLabel="Temperature"
            />
        );

        const root = getByTestId('range-slider');
        const track = getByTestId('range-slider-track');
        const fill = getByTestId('range-slider-fill');
        const thumb = getByTestId('range-slider-thumb');
        const ticks = getByTestId('range-slider-ticks');

        expect(root.props.style).toEqual(
            expect.objectContaining({ height: RANGE_SLIDER_HIT_HEIGHT })
        );
        expect(RANGE_SLIDER_HIT_HEIGHT).toBeGreaterThanOrEqual(44);
        expect(RANGE_SLIDER_GROOVE_HEIGHT).toBeLessThanOrEqual(3);

        // Groove is a thin channel, not a fat pill
        expect(track.props.style).toEqual(
            expect.objectContaining({
                backgroundColor: '#C7C7CC',
                height: RANGE_SLIDER_GROOVE_HEIGHT + 4,
            })
        );

        const fillStyles = Array.isArray(fill.props.style) ? fill.props.style : [fill.props.style];
        expect(fillStyles).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ backgroundColor: TintColors.light }),
            ])
        );

        // Compact circle: equal width/height, full radius, solid amber — no tall capsule/notch.
        expect(RANGE_SLIDER_THUMB_SIZE).toBe(RANGE_SLIDER_THUMB_WIDTH);
        expect(RANGE_SLIDER_THUMB_SIZE).toBeLessThanOrEqual(20);
        expect(RANGE_SLIDER_THUMB_SIZE).toBeGreaterThan(RANGE_SLIDER_GROOVE_HEIGHT);

        const thumbStyles = Array.isArray(thumb.props.style)
            ? thumb.props.style
            : [thumb.props.style];
        expect(thumbStyles).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    width: RANGE_SLIDER_THUMB_SIZE,
                    height: RANGE_SLIDER_THUMB_SIZE,
                    borderRadius: RANGE_SLIDER_THUMB_SIZE / 2,
                    backgroundColor: TintColors.light,
                    marginTop: -(RANGE_SLIDER_THUMB_SIZE / 2),
                }),
            ])
        );
        expect(queryByTestId('range-slider-thumb-notch')).toBeNull();
        expect(ticks.props.children.length).toBeGreaterThan(2);
    });

    it('announces min-bound and max-bound values for Temperature range', () => {
        const { getByLabelText, rerender } = render(
            <RangeSlider
                value={0}
                min={0}
                max={2}
                step={0.1}
                onChange={jest.fn()}
                accessibilityLabel="Temperature"
            />
        );
        expect(getByLabelText('Temperature').props.accessibilityValue.now).toBe(0);

        rerender(
            <RangeSlider
                value={2}
                min={0}
                max={2}
                step={0.1}
                onChange={jest.fn()}
                accessibilityLabel="Temperature"
            />
        );
        expect(getByLabelText('Temperature').props.accessibilityValue.now).toBe(2);
    });

    it('is a precision instrument control — not a gradient glow blob thumb', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require('fs') as typeof import('fs');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const path = require('path') as typeof import('path');
        const ui = fs.readFileSync(
            path.join(process.cwd(), 'components/ui/RangeSlider.tsx'),
            'utf8'
        );
        const model = fs.readFileSync(
            path.join(process.cwd(), 'utils/rangeSlider.ts'),
            'utf8'
        );
        expect(ui).toContain('Precision-instrument');
        expect(ui).toContain('compact circle');
        expect(ui).toContain('withTiming');
        expect(ui).not.toContain('withSpring');
        expect(ui).not.toContain('thumb-notch');
        expect(model).toContain('buildRangeSliderTicks');
        expect(model).toContain('rangeSliderInstrumentPalette');
        expect(ui).not.toMatch(/thumbClassName\s*=\s*['"][^'"]*bg-primary/);
        // No tall vertical capsule proportions
        expect(model).toMatch(/RANGE_SLIDER_THUMB_SIZE = 16/);
    });
});

