import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { MemoryGraphRangeRail } from '../../components/memory-graph/MemoryGraphRangeRail';
import {
    MEMORY_RANGE_STOPS,
    memoryRangeRatio,
    memoryRangeStopAt,
} from '../../utils/memoryRange';

jest.mock('../../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'dark',
}));

describe('MemoryGraphRangeRail', () => {
    it('names the active window and moves the handle along the track', () => {
        const { rerender } = render(
            <MemoryGraphRangeRail value={MEMORY_RANGE_STOPS.length - 1} onChange={jest.fn()} />
        );

        expect(screen.getByText('All time')).toBeTruthy();
        expect(screen.getByTestId('memory-range-handle').props.style).toMatchObject({
            left: '100%',
        });

        // The concept's five graduations are all laid out on one hairline.
        MEMORY_RANGE_STOPS.forEach((stop, index) => {
            expect(
                screen.getByTestId(`memory-range-stop-${stop.key}`).props.style
            ).toMatchObject({ left: `${memoryRangeRatio(index) * 100}%` });
        });

        rerender(<MemoryGraphRangeRail value={0} onChange={jest.fn()} />);
        expect(screen.getByText('1 month')).toBeTruthy();
        expect(screen.getByTestId('memory-range-handle').props.style).toMatchObject({
            left: '0%',
        });
    });

    it('reports the tapped stop so the caller can narrow the window', () => {
        const onChange = jest.fn();
        render(
            <MemoryGraphRangeRail value={MEMORY_RANGE_STOPS.length - 1} onChange={onChange} />
        );

        fireEvent.press(screen.getByTestId('memory-range-stop-quarter'));

        expect(onChange).toHaveBeenCalledWith(1);
    });

    it('describes the selected window for screen readers', () => {
        render(<MemoryGraphRangeRail value={4} onChange={jest.fn()} />);

        expect(
            screen.getByLabelText('Show memories from the all time').props
                .accessibilityState
        ).toMatchObject({ selected: true });
        expect(
            screen.getByLabelText('Show memories from the 1 month').props
                .accessibilityState
        ).toMatchObject({ selected: false });
    });
});

describe('memory range stops', () => {
    it('maps each stop to a day window, with all time unfiltered', () => {
        expect(MEMORY_RANGE_STOPS.map((stop) => stop.days)).toEqual([
            30, 90, 180, 365, null,
        ]);
        expect(memoryRangeStopAt(0).key).toBe('month');
        expect(memoryRangeStopAt(99).key).toBe('all');
        expect(memoryRangeStopAt(-3).key).toBe('month');
    });

    it('spans the rail evenly from 0 to 1', () => {
        expect(memoryRangeRatio(0)).toBe(0);
        expect(memoryRangeRatio(2)).toBe(0.5);
        expect(memoryRangeRatio(4)).toBe(1);
        expect(memoryRangeRatio(9)).toBe(1);
    });
});
