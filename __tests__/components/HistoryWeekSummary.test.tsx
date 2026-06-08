import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { HistoryWeekSummary } from '../../components/history/HistoryWeekSummary';
import type { WeeklyHistorySummary } from '../../hooks/history/historyUtils';

jest.mock('../../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: ({ name }: { name: string }) => {
        const React = jest.requireActual('react');
        const { Text } = jest.requireActual('react-native');
        return <Text>{name}</Text>;
    },
}));

const summary: WeeklyHistorySummary = {
    label: 'Jun 1 - Jun 7',
    itemCount: 4,
    journalCount: 2,
    checkInCount: 2,
    activeDays: 3,
    topSignals: ['career', 'rest'],
};

describe('HistoryWeekSummary', () => {
    it('renders weekly history metrics and signals', () => {
        render(<HistoryWeekSummary summary={summary} />);

        expect(screen.getByText('This week')).toBeTruthy();
        expect(screen.getByText('Jun 1 - Jun 7')).toBeTruthy();
        expect(screen.getByText('Entries')).toBeTruthy();
        expect(screen.getByText('Check-ins')).toBeTruthy();
        expect(screen.getByText('Career / Rest')).toBeTruthy();
    });
});
