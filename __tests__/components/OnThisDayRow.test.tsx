import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { OnThisDayRow, OnThisDayMemory } from '@/components/today/OnThisDayRow';
import type { OnThisDayPick } from '@/utils/onThisDay';

const memory: OnThisDayMemory = {
    id: 'journal-entry-1',
    sourceId: 'entry-1',
    dateKey: '2024-11-08',
    createdAt: 1731000000000,
    title: 'A quiet morning',
    summary: 'The kettle was the loudest thing in the flat.',
};

const pick: OnThisDayPick<OnThisDayMemory> = {
    entry: memory,
    yearsAgo: 2,
    label: 'Two years ago today',
};

describe('OnThisDayRow', () => {
    it('shows the years label and the writer own words', () => {
        render(<OnThisDayRow pick={pick} onPress={jest.fn()} />);
        expect(screen.getByText('Two years ago today')).toBeTruthy();
        expect(screen.getByText('A quiet morning')).toBeTruthy();
        expect(screen.getByText('The kettle was the loudest thing in the flat.')).toBeTruthy();
    });

    it('opens the saved entry when tapped', () => {
        const onPress = jest.fn();
        render(<OnThisDayRow pick={pick} onPress={onPress} />);
        fireEvent.press(screen.getByLabelText('Open A quiet morning'));
        expect(onPress).toHaveBeenCalledWith('entry-1', 'journal');
    });

    it('renders nothing when there is no earlier year', () => {
        const view = render(<OnThisDayRow pick={null} onPress={jest.fn()} />);
        expect(view.toJSON()).toBeNull();
    });
});
