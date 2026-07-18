import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { HistoryWeekRhythm } from '../../components/history/HistoryWeekRhythm';
import type { WeeklyHistorySummary } from '../../hooks/history/historyUtils';

jest.mock('react-native-reanimated', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { View } = require('react-native');
    return {
        __esModule: true,
        default: {
            View,
            createAnimatedComponent: (C: unknown) => C,
        },
        useSharedValue: (v: number) => ({ value: v }),
        useAnimatedStyle: () => ({}),
        withDelay: (_d: number, v: unknown) => v,
        withSpring: (v: unknown) => v,
        ReduceMotion: { System: 'system' },
    };
});

const summary: WeeklyHistorySummary = {
    label: 'Jun 1 - Jun 7',
    itemCount: 4,
    journalCount: 2,
    checkInCount: 2,
    activeDays: 3,
    activeDayKeys: ['2026-06-01', '2026-06-02', '2026-06-04'],
    weekDayKeys: [
        '2026-05-31',
        '2026-06-01',
        '2026-06-02',
        '2026-06-03',
        '2026-06-04',
        '2026-06-05',
        '2026-06-06',
    ],
    topSignals: ['career', 'rest'],
};

describe('HistoryWeekRhythm', () => {
    it('renders presence prose without metric columns or signals fluff', () => {
        render(
            <HistoryWeekRhythm
                summary={summary}
                now={new Date(2026, 5, 3, 12)}
            />
        );

        expect(screen.getByText('4 entries · 3 days')).toBeTruthy();
        expect(screen.queryByText('Entries')).toBeNull();
        expect(screen.queryByText('Check-ins')).toBeNull();
        expect(screen.queryByText('Active days')).toBeNull();
        expect(screen.queryByText('Signals:')).toBeNull();
        expect(screen.queryByText('quiet, reflective, open')).toBeNull();
        expect(screen.getByLabelText('This week: 4 entries · 3 days')).toBeTruthy();
    });

    it('hides prose when the week is empty', () => {
        render(
            <HistoryWeekRhythm
                summary={{
                    ...summary,
                    itemCount: 0,
                    activeDays: 0,
                    activeDayKeys: [],
                }}
            />
        );
        expect(screen.queryByText(/entries/)).toBeNull();
        expect(screen.getByLabelText('This week has no history items yet')).toBeTruthy();
    });
});
