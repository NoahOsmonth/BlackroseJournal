/* eslint-disable import/first */

import React, { useEffect } from 'react';
import { render, waitFor } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
    },
}));

jest.mock('../../hooks/journal/useJournalEntries', () => ({
    useJournalEntries: () => ({
        completed: mockCompletedEntries,
        isLoading: false,
    }),
}));

jest.mock('../../services/ai/insights', () => ({
    generateWeeklyInsights: jest.fn().mockResolvedValue({
        emotionalLandscape: [],
        keyThemes: [],
        castOfCharacters: [],
        weeklySummary: 'Test summary.',
    }),
}));

jest.mock('../../services/insights/weeklyInsightsStorage', () => ({
    getCurrentWeekKey: jest.fn().mockReturnValue('2026-W24'),
    loadCachedInsights: jest.fn().mockResolvedValue(null),
    saveCachedInsights: jest.fn().mockResolvedValue(undefined),
}));

import { useWeeklyInsights } from '../../hooks/insights/useWeeklyInsights';
import type { JournalEntry } from '../../services/journal/journalStorage.types';

let mockCompletedEntries: JournalEntry[] = [];

function buildEntry(createdAt: number, userContents: string[]): JournalEntry {
    return {
        id: `entry-${createdAt}`,
        title: 'Test entry',
        emoji: '📝',
        status: 'completed',
        createdAt,
        updatedAt: createdAt,
        messages: userContents.map((content, index) => ({
            id: `msg-${createdAt}-${index}`,
            role: 'user',
            content,
            timestamp: createdAt + index,
        })),
    };
}

type HookResult = ReturnType<typeof useWeeklyInsights>;

function Harness({ expose }: { expose: (result: HookResult) => void }) {
    const result = useWeeklyInsights();

    useEffect(() => {
        expose(result);
    }, [expose, result]);

    return null;
}

describe('useWeeklyInsights weeklyStats', () => {
    beforeEach(() => {
        mockCompletedEntries = [];
    });

    it('computes maxWords as the peak daily word count', async () => {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const monday = new Date(startOfWeek);
        monday.setDate(startOfWeek.getDate() + 1);
        monday.setHours(12, 0, 0, 0);

        const wednesday = new Date(startOfWeek);
        wednesday.setDate(startOfWeek.getDate() + 3);
        wednesday.setHours(12, 0, 0, 0);

        mockCompletedEntries = [
            buildEntry(monday.getTime(), ['a b c d e f g h i j']),
            buildEntry(wednesday.getTime(), [
                'one two three four five six seven eight nine ten',
                'eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty',
            ]),
        ];

        let result: HookResult | undefined;
        render(<Harness expose={(next) => { result = next; }} />);

        await waitFor(() => expect(result?.weeklyStats.maxWords).toBe(20));
        expect(result?.weeklyStats.dailyWords).toEqual([0, 10, 0, 20, 0, 0, 0]);
        expect(result?.weeklyStats.totalWords).toBe(30);
    });

    it('returns maxWords of 0 when there are no entries this week', async () => {
        mockCompletedEntries = [];

        let result: HookResult | undefined;
        render(<Harness expose={(next) => { result = next; }} />);

        await waitFor(() => expect(result?.weeklyStats.maxWords).toBe(0));
        expect(result?.weeklyStats.dailyWords).toEqual([0, 0, 0, 0, 0, 0, 0]);
    });

    it('handles equal daily peaks correctly', async () => {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const tuesday = new Date(startOfWeek);
        tuesday.setDate(startOfWeek.getDate() + 2);
        tuesday.setHours(12, 0, 0, 0);

        const thursday = new Date(startOfWeek);
        thursday.setDate(startOfWeek.getDate() + 4);
        thursday.setHours(12, 0, 0, 0);

        mockCompletedEntries = [
            buildEntry(tuesday.getTime(), ['one two three four five']),
            buildEntry(thursday.getTime(), ['six seven eight nine ten']),
        ];

        let result: HookResult | undefined;
        render(<Harness expose={(next) => { result = next; }} />);

        await waitFor(() => expect(result?.weeklyStats.maxWords).toBe(5));
        expect(result?.weeklyStats.dailyWords).toEqual([0, 0, 5, 0, 5, 0, 0]);
    });
});
