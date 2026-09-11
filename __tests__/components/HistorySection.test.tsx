import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { HistorySection } from '../../components/history/HistorySection';
import type { HistorySection as HistorySectionModel } from '../../hooks/history/historyUtils';

jest.mock('../../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    ImpactFeedbackStyle: { Light: 'light' },
}));

function buildSection(overrides: Partial<HistorySectionModel> = {}): HistorySectionModel {
    return {
        dateKey: '2026-01-23',
        label: 'Today',
        dayNumber: 23,
        weekdayShort: 'Fri',
        relativeLabel: 'today',
        monthKey: '2026-01',
        monthLabel: 'January',
        items: [
            {
                id: 'e1',
                type: 'journal',
                title: 'Wellbeing Important For My Goals',
                summary: 'Reflected on the importance of wellbeing.',
                createdAt: new Date(2026, 0, 23, 17, 4).getTime(),
                sourceId: '1',
            },
        ],
        ...overrides,
    };
}

describe('HistorySection', () => {
    it('heads each day group with a serif "Day · Month D" label', () => {
        render(<HistorySection section={buildSection()} onPressItem={jest.fn()} />);

        const heading = screen.getByRole('header');
        expect(heading.props.children).toBe('Today · January 23');
        expect(heading.props.style).toEqual(
            expect.objectContaining({ fontFamily: 'PlayfairDisplayRegular' })
        );
    });

    it('falls back to the weekday short name for older days', () => {
        render(
            <HistorySection
                section={buildSection({ relativeLabel: null, weekdayShort: 'Tue' })}
                onPressItem={jest.fn()}
            />
        );

        expect(screen.getByRole('header').props.children).toBe('Tue · January 23');
    });

    it('renders one card per entry', () => {
        render(<HistorySection section={buildSection()} onPressItem={jest.fn()} />);

        expect(screen.getByLabelText('Open Wellbeing Important For My Goals')).toBeTruthy();
    });
});
