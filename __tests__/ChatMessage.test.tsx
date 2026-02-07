import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { ChatMessage } from '../components/ChatMessage';

jest.mock('@/hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

jest.mock('@/components/ui/TypingIndicator', () => {
    const ReactMock = require('react');
    const { Text: RNText } = require('react-native');
    return {
        TypingIndicator: () => <RNText testID="typing-indicator">typing</RNText>,
    };
});

jest.mock('react-native-marked', () => {
    const ReactMock = require('react');
    const { Text: RNText } = require('react-native');
    return ({ value }: { value: string }) => <RNText>{value}</RNText>;
});

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: () => null,
}));

describe('ChatMessage streaming visibility', () => {
    it('shows typing indicator before streamed chunks arrive', () => {
        const { getByTestId } = render(
            <ChatMessage isAi text="" isStreaming={true} />
        );

        expect(getByTestId('typing-indicator')).toBeTruthy();
    });

    it('shows streamed reasoning when content has not started', () => {
        const { queryByTestId, getByText } = render(
            <ChatMessage isAi text="" reasoning="thinking" isStreaming={true} />
        );

        expect(queryByTestId('typing-indicator')).toBeNull();
        expect(getByText('AI reasoning (live)')).toBeTruthy();
        expect(getByText('thinking')).toBeTruthy();
    });

    it('renders streamed text while streaming is active', () => {
        const { queryByTestId, getByText, rerender } = render(
            <ChatMessage isAi text="" isStreaming={true} />
        );

        rerender(<ChatMessage isAi text="stream" isStreaming={true} />);

        expect(queryByTestId('typing-indicator')).toBeNull();
        expect(getByText('stream')).toBeTruthy();
    });
});
