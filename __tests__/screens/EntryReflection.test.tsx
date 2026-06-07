import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import EntryReflectionScreen from '../../app/entry-reflection';
import { saveAiFeedback } from '@/services/feedback/feedbackStorage';

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

jest.mock('@/hooks/useEntryReflection', () => ({
    useEntryReflection: () => ({
        data: {
            reflection: 'You are finding your pace.',
            keyInsight: 'Small rituals help.',
            suggestions: [],
        },
        isLoading: false,
        error: null,
    }),
}));

jest.mock('@/services/feedback/feedbackStorage', () => ({
    saveAiFeedback: jest.fn(() => Promise.resolve({ id: 'feedback-1' })),
}));

describe('EntryReflectionScreen feedback', () => {
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
