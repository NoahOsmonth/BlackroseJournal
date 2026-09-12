import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import EntryReflectionScreen from '../../app/entry-reflection';
import { saveAiFeedback } from '@/services/feedback/feedbackStorage';
import type { FinishBackgroundStatus } from '@/services/journal/finishBackgroundStore';

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: () => null,
}));

jest.mock('expo-router', () => ({
    useLocalSearchParams: () => ({ entryId: 'entry-1' }),
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

jest.mock('@/hooks/use-theme-color', () => ({
    useThemeColor: () => '#FF9F0A',
}));

// `refresh` is deliberately a fresh arrow per render (the pre-fix hook did the
// same). The screen must not re-fire the AI call just because its identity
// changed.
const mockRefresh = jest.fn(() => Promise.resolve());

jest.mock('@/hooks/useEntryReflection', () => ({
    useEntryReflection: () => ({
        data: {
            reflection: 'You are finding your pace.',
            keyInsight: 'Small rituals help.',
            suggestions: [],
        },
        isLoading: false,
        error: null,
        refresh: () => mockRefresh(),
    }),
}));

const mockBackgroundStatus: { current: FinishBackgroundStatus | null } = { current: null };

jest.mock('@/hooks/journal/useFinishBackgroundStatus', () => ({
    useFinishBackgroundStatus: () => ({
        status: mockBackgroundStatus.current,
        isRunning: false,
        isDone: mockBackgroundStatus.current !== null,
    }),
}));

jest.mock('@/services/feedback/feedbackStorage', () => ({
    saveAiFeedback: jest.fn(() => Promise.resolve({ id: 'feedback-1' })),
}));

function settledRun(entryId: string, runId = 'finish-run-1'): FinishBackgroundStatus {
    return {
        runId,
        entryId,
        startedAt: 1_000,
        done: {
            analysis: true,
            memories: true,
            digest: true,
            identity: true,
            sessionDigest: true,
            hindsight: true,
        },
    };
}

describe('EntryReflectionScreen feedback', () => {
    beforeEach(() => {
        mockRefresh.mockClear();
        mockBackgroundStatus.current = null;
    });

    it('opens a comment popup and saves reflection feedback to memory', async () => {
        const { getByLabelText, getByPlaceholderText, getByText } = render(
            <EntryReflectionScreen />
        );

        fireEvent.press(getByLabelText('Thumbs up'));
        fireEvent.changeText(
            getByPlaceholderText('Add a note about tone, pacing, or wording...'),
            'More like this.'
        );
        fireEvent.press(getByText('Save'));

        await waitFor(() => {
            expect(saveAiFeedback).toHaveBeenCalledWith(expect.objectContaining({
                scope: 'journal',
                conversationId: 'entry-1',
                value: 'up',
                comment: 'More like this.',
                messageContent: 'You are finding your pace.',
            }));
        });
    });
});

describe('EntryReflectionScreen background refresh', () => {
    beforeEach(() => {
        mockRefresh.mockClear();
        mockBackgroundStatus.current = null;
    });

    it('refreshes once for the finished run, not once per render', async () => {
        mockBackgroundStatus.current = settledRun('entry-1');

        const { rerender } = render(<EntryReflectionScreen />);

        await waitFor(() => {
            expect(mockRefresh).toHaveBeenCalledTimes(1);
        });

        // Re-renders used to re-fire the effect (unstable `refresh` identity)
        // and each firing queued another AI request.
        rerender(<EntryReflectionScreen />);
        rerender(<EntryReflectionScreen />);

        expect(mockRefresh).toHaveBeenCalledTimes(1);
    });

    it('ignores a settled run that belongs to another entry', async () => {
        mockBackgroundStatus.current = settledRun('some-other-entry');

        const { rerender } = render(<EntryReflectionScreen />);
        rerender(<EntryReflectionScreen />);

        expect(mockRefresh).not.toHaveBeenCalled();
    });

    it('refreshes once when a new run settles for the same entry', async () => {
        mockBackgroundStatus.current = settledRun('entry-1', 'finish-run-1');

        const { rerender } = render(<EntryReflectionScreen />);
        await waitFor(() => {
            expect(mockRefresh).toHaveBeenCalledTimes(1);
        });

        mockBackgroundStatus.current = settledRun('entry-1', 'finish-run-2');
        rerender(<EntryReflectionScreen />);

        expect(mockRefresh).toHaveBeenCalledTimes(2);
    });
});
