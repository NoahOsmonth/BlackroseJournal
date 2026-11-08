import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { UnlockDatePicker } from '@/components/letters/UnlockDatePicker';

const TODAY = '2026-11-08';

describe('UnlockDatePicker', () => {
    it('offers the three quick choices with plain-words dates', () => {
        const { getByLabelText } = render(
            <UnlockDatePicker todayKey={TODAY} value="2026-12-08" onChange={jest.fn()} />,
        );
        expect(getByLabelText('Open in a week, on Sunday 15 November 2026')).toBeTruthy();
        expect(getByLabelText('Open in a month, on Tuesday 8 December 2026')).toBeTruthy();
        expect(getByLabelText('Open in a year, on Monday 8 November 2027')).toBeTruthy();
    });

    it('reports the chosen day in plain words', () => {
        const { getByText } = render(
            <UnlockDatePicker todayKey={TODAY} value="2026-12-08" onChange={jest.fn()} />,
        );
        expect(getByText('Opens on Tuesday 8 December 2026')).toBeTruthy();
    });

    it('hands back the quick choice key when tapped', () => {
        const onChange = jest.fn();
        const { getByLabelText } = render(
            <UnlockDatePicker todayKey={TODAY} value="2026-12-08" onChange={onChange} />,
        );
        fireEvent.press(getByLabelText('Open in a week, on Sunday 15 November 2026'));
        expect(onChange).toHaveBeenCalledWith('2026-11-15');
    });

    it('hands back a calendar day when tapped', () => {
        const onChange = jest.fn();
        const { getByLabelText } = render(
            <UnlockDatePicker todayKey={TODAY} value="2026-12-08" onChange={onChange} />,
        );
        fireEvent.press(getByLabelText('Tuesday 1 December 2026'));
        expect(onChange).toHaveBeenCalledWith('2026-12-01');
    });

    it('will not hand back a day already gone', () => {
        const onChange = jest.fn();
        const { getByLabelText } = render(
            <UnlockDatePicker todayKey={TODAY} value="2026-12-08" onChange={onChange} />,
        );
        fireEvent.press(getByLabelText('Sunday 1 November 2026'));
        expect(onChange).not.toHaveBeenCalled();
    });

    it('marks the chosen day as selected', () => {
        const { getByLabelText } = render(
            <UnlockDatePicker todayKey={TODAY} value="2026-11-15" onChange={jest.fn()} />,
        );
        expect(getByLabelText('Sunday 15 November 2026').props.accessibilityState).toEqual({
            selected: true,
            disabled: false,
        });
    });
});
