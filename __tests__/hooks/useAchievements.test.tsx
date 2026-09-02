/* eslint-disable import/first */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';

// Force a timezone that observes DST so the fall-back 25-hour day is real.
process.env.TZ = 'America/New_York';

jest.mock('../../hooks/journal/useJournalEntries', () => ({
    useJournalEntries: () => ({
        completed: mockCompleted,
        isLoading: false,
    }),
}));

import { useAchievements } from '../../hooks/achievements/useAchievements';
import type { JournalEntry } from '../../services/journal/journalStorage.types';

let mockCompleted: JournalEntry[] = [];

function entryAt(ts: number): JournalEntry {
    return {
        id: `e-${ts}`,
        title: 't',
        emoji: '📝',
        status: 'completed',
        createdAt: ts,
        updatedAt: ts,
        messages: [{ id: `m-${ts}`, role: 'user', content: 'x', timestamp: ts }],
    };
}

type HookResult = ReturnType<typeof useAchievements>;
function Harness({ expose }: { expose: (r: HookResult) => void }) {
    const r = useAchievements();
    useEffect(() => { expose(r); }, [expose, r]);
    return null;
}

describe('useAchievements longest streak across DST fall-back', () => {
    beforeEach(() => { mockCompleted = []; });

    it('counts five consecutive local days even when Nov 1 is a 25-hour day', async () => {
        // 2026 DST fall-back is Nov 1 (Sunday) in America/New_York. Write one entry
        // at local noon each day. Local calendar days are contiguous, so the streak
        // must be 5 regardless of the 25-hour wall-clock gap.
        const days = ['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'];
        mockCompleted = days.map((d) => entryAt(new Date(`${d}T12:00:00`).getTime()));

        let result: HookResult | undefined;
        render(<Harness expose={(next) => { result = next; }} />);
        await waitFor(() => expect(result?.longestStreak).toBe(5));
        // currentStreak compares against the live clock (real today), which is not
        // Nov 2026 in CI — only the DST-robust longestStreak is asserted here.
    });

    it('still resets at a real gap', async () => {
        // Nov 2 and Nov 4 are contiguous-with-one-missing on the calendar? No:
        // Nov 2 followed by Nov 4 leaves a gap, streak becomes 1.
        const days = ['2026-11-02', '2026-11-04'];
        mockCompleted = days.map((d) => entryAt(new Date(`${d}T12:00:00`).getTime()));

        let result: HookResult | undefined;
        render(<Harness expose={(next) => { result = next; }} />);
        await waitFor(() => expect(result).toBeDefined());
        expect(result?.longestStreak).toBe(1);
    });
});