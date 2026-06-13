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

jest.mock('../../hooks/intentions/useIntentionCheckIns', () => ({
    useIntentionCheckIns: () => ({
        completed: mockCompletedCheckIns,
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
import { generateWeeklyInsights } from '../../services/ai/insights';
import type { JournalEntry } from '../../services/journal/journalStorage.types';
import type { IntentionCheckIn } from '../../services/intentions/intentionsStorage.types';

let mockCompletedEntries: JournalEntry[] = [];
let mockCompletedCheckIns: IntentionCheckIn[] = [];

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

function buildCheckIn(createdAt: number, userContents: string[]): IntentionCheckIn {
    return {
        id: `checkin-${createdAt}`,
        type: 'morning',
        title: 'Morning intention',
        summary: 'A morning check-in',
        status: 'completed',
        createdAt,
        updatedAt: createdAt,
        messages: userContents.map((content, index) => ({
            id: `ci-${createdAt}-${index}`,
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

function getStartOfWeek(now = new Date()): Date {
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek;
}

describe('useWeeklyInsights weeklyStats', () => {
    beforeEach(() => {
        mockCompletedEntries = [];
        mockCompletedCheckIns = [];
        (generateWeeklyInsights as jest.Mock).mockClear();
    });

    it('computes maxWords as the peak daily word count', async () => {
        const startOfWeek = getStartOfWeek();

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
        const startOfWeek = getStartOfWeek();

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

    it('includes completed intention check-ins in weeklyStats alongside journal entries', async () => {
        const startOfWeek = getStartOfWeek();

        const monday = new Date(startOfWeek);
        monday.setDate(startOfWeek.getDate() + 1);
        monday.setHours(12, 0, 0, 0);

        const wednesday = new Date(startOfWeek);
        wednesday.setDate(startOfWeek.getDate() + 3);
        wednesday.setHours(12, 0, 0, 0);

        mockCompletedEntries = [buildEntry(monday.getTime(), ['a b c d e f g h i j'])];
        mockCompletedCheckIns = [
            buildCheckIn(wednesday.getTime(), [
                'one two three four five six seven eight nine ten',
                'eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty',
            ]),
        ];

        let result: HookResult | undefined;
        render(<Harness expose={(next) => { result = next; }} />);

        await waitFor(() => expect(result?.weeklyStats.maxWords).toBe(20));
        expect(result?.weeklyStats.entriesCount).toBe(2);
        expect(result?.weeklyStats.totalWords).toBe(30);
        expect(result?.weeklyStats.dailyWords).toEqual([0, 10, 0, 20, 0, 0, 0]);

        await waitFor(() => expect(generateWeeklyInsights).toHaveBeenCalledTimes(1));
        const payload = (generateWeeklyInsights as jest.Mock).mock.calls[0][0];
        expect(payload).toHaveLength(2);
        expect(payload[0].messages.map((m: { content: string }) => m.content)).toEqual([
            'a b c d e f g h i j',
        ]);
        expect(payload[1].messages.map((m: { content: string }) => m.content)).toEqual([
            'one two three four five six seven eight nine ten',
            'eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty',
        ]);
    });

    it('counts check-ins only when no journal entries exist', async () => {
        const startOfWeek = getStartOfWeek();

        const tuesday = new Date(startOfWeek);
        tuesday.setDate(startOfWeek.getDate() + 2);
        tuesday.setHours(12, 0, 0, 0);

        mockCompletedEntries = [];
        mockCompletedCheckIns = [buildCheckIn(tuesday.getTime(), ['one two three four five'])];

        let result: HookResult | undefined;
        render(<Harness expose={(next) => { result = next; }} />);

        await waitFor(() => expect(result?.weeklyStats.entriesCount).toBe(1));
        expect(result?.weeklyStats.totalWords).toBe(5);
        expect(result?.weeklyStats.maxWords).toBe(5);
        expect(result?.weeklyStats.dailyWords).toEqual([0, 0, 5, 0, 0, 0, 0]);

        await waitFor(() => expect(generateWeeklyInsights).toHaveBeenCalledTimes(1));
    });

    it('still computes stats from journal entries when no check-ins are present', async () => {
        const startOfWeek = getStartOfWeek();

        const friday = new Date(startOfWeek);
        friday.setDate(startOfWeek.getDate() + 5);
        friday.setHours(12, 0, 0, 0);

        mockCompletedEntries = [buildEntry(friday.getTime(), ['alpha beta gamma delta epsilon'])];
        mockCompletedCheckIns = [];

        let result: HookResult | undefined;
        render(<Harness expose={(next) => { result = next; }} />);

        await waitFor(() => expect(result?.weeklyStats.entriesCount).toBe(1));
        expect(result?.weeklyStats.totalWords).toBe(5);
        expect(result?.weeklyStats.maxWords).toBe(5);
        expect(result?.weeklyStats.dailyWords).toEqual([0, 0, 0, 0, 0, 5, 0]);
    });

    it('handles check-ins with no messages without crashing', async () => {
        const startOfWeek = getStartOfWeek();

        const thursday = new Date(startOfWeek);
        thursday.setDate(startOfWeek.getDate() + 4);
        thursday.setHours(12, 0, 0, 0);

        mockCompletedEntries = [];
        mockCompletedCheckIns = [
            {
                id: 'empty-checkin',
                type: 'evening',
                title: 'Nightly reflection',
                summary: 'No messages',
                status: 'completed',
                createdAt: thursday.getTime(),
                updatedAt: thursday.getTime(),
            },
        ];

        let result: HookResult | undefined;
        render(<Harness expose={(next) => { result = next; }} />);

        await waitFor(() => expect(result?.weeklyStats.entriesCount).toBe(1));
        expect(result?.weeklyStats.totalWords).toBe(0);
        expect(result?.weeklyStats.maxWords).toBe(0);

        await waitFor(() => expect(generateWeeklyInsights).toHaveBeenCalledTimes(1));
        const payload = (generateWeeklyInsights as jest.Mock).mock.calls[0][0];
        expect(payload).toHaveLength(1);
        expect(payload[0].messages).toEqual([]);
    });

    it('shows the empty state when neither entries nor check-ins exist this week', async () => {
        mockCompletedEntries = [];
        mockCompletedCheckIns = [];

        let result: HookResult | undefined;
        render(<Harness expose={(next) => { result = next; }} />);

        await waitFor(() => expect(result?.insights?.weeklySummary).toBe('No entries yet this week.'));
        expect(generateWeeklyInsights).not.toHaveBeenCalled();
    });
});
