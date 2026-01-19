import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import AskRosebudScreen from '../../app/ask-rosebud';

const mockSendQuestion = jest.fn();
let mockIsLoading = false;
let mockMessages: Array<{ id: string; role: 'user' | 'assistant'; content: string }> = [];
let mockErrorMessage: string | null = null;

jest.mock('../../hooks/useAskRosebud', () => ({
    useAskRosebud: () => ({
        messages: mockMessages,
        isLoading: mockIsLoading,
        errorMessage: mockErrorMessage,
        sendQuestion: mockSendQuestion,
        clearMessages: jest.fn(),
    }),
}));

jest.mock('../../hooks/useJournalEntries', () => ({
    useJournalEntries: () => ({
        completed: [],
    }),
}));

jest.mock('expo-router', () => ({
    useRouter: () => ({
        back: jest.fn(),
    }),
}));

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: 'MaterialIcons',
}));

jest.mock('@/hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

describe('AskRosebudScreen', () => {
    beforeEach(() => {
        mockSendQuestion.mockClear();
        mockIsLoading = false;
        mockMessages = [];
        mockErrorMessage = null;
    });

    it('disables suggested questions and input while loading', () => {
        mockIsLoading = true;

        render(<AskRosebudScreen />);

        const question = screen.getByText('What patterns do you see in my mood?');
        fireEvent.press(question);
        expect(mockSendQuestion).not.toHaveBeenCalled();

        const input = screen.getByPlaceholderText('Ask about your journal...');
        expect(input.props.editable).toBe(false);

        expect(screen.getByLabelText('AI typing indicator')).toBeTruthy();
    });

    it('sends a suggested question when not loading', () => {
        render(<AskRosebudScreen />);

        fireEvent.press(screen.getByText('What makes me happiest?'));
        expect(mockSendQuestion).toHaveBeenCalled();
    });
});
