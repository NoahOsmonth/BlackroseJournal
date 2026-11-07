import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { MoodStrip } from '@/components/insights/MoodStrip';
import { MoodDayCell } from '@/utils/moodStrip';

// Sun 1 Nov 2026 .. Sat 7 Nov 2026: real weekday names, so the labels under
// test match the calendar instead of whatever the fixture happens to say.
const WEEK_KEYS = [
    '2026-11-01',
    '2026-11-02',
    '2026-11-03',
    '2026-11-04',
    '2026-11-05',
    '2026-11-06',
    '2026-11-07',
];

function week(moods: (string | null)[]): MoodDayCell[] {
    return moods.map((mood, index) => ({
        dateKey: WEEK_KEYS[index],
        mood,
        hasWriting: mood !== null,
        entryCount: mood ? 1 : 0,
    }));
}

describe('MoodStrip', () => {
    it('shows each written mood word and counts the week', () => {
        render(<MoodStrip cells={week([null, 'Calm', null, 'Proud', null, null, 'Hopeful'])} />);
        expect(screen.getByText('Calm')).toBeTruthy();
        expect(screen.getByText('Proud')).toBeTruthy();
        expect(screen.getByText('3 of 7 days have a mood.')).toBeTruthy();
    });

    it('labels an empty day as no writing, not as a bad mood', () => {
        render(<MoodStrip cells={week([null, 'Calm', null, null, null, null, null])} />);
        expect(screen.getByLabelText('Sunday: no writing')).toBeTruthy();
        expect(screen.queryByLabelText(/Sunday: Calm/)).toBeNull();
    });

    it('shows a quiet empty state when nothing is written this week', () => {
        render(<MoodStrip cells={week([null, null, null, null, null, null, null])} />);
        expect(screen.getByText('Your moods appear here after a few days of writing.')).toBeTruthy();
        expect(screen.queryByText(/of 7 days/)).toBeNull();
    });

    it('names the day when tapped', () => {
        const onSelectDay = jest.fn();
        const cells = week([null, 'Calm', null, null, null, null, null]);
        render(<MoodStrip cells={cells} onSelectDay={onSelectDay} />);
        fireEvent.press(screen.getByLabelText('Monday: Calm'));
        expect(onSelectDay).toHaveBeenCalledWith(expect.objectContaining({ mood: 'Calm' }));
    });
});
