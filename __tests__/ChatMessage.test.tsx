import React from 'react';
import { render } from '@testing-library/react-native';
import { ChatMessage } from '../components/ChatMessage';

const mockMarkdownRender = jest.fn();

jest.mock('@/hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

jest.mock('@/components/ui/TypingIndicator', () => {
    const React = jest.requireActual('react');
    const { Text: RNText } = jest.requireActual('react-native');
    return {
        TypingIndicator: function TypingIndicator() {
            return React.createElement(RNText, { testID: 'typing-indicator' }, 'typing');
        },
    };
});

jest.mock('react-native-marked', () => {
    const React = jest.requireActual('react');
    const { Text: RNText } = jest.requireActual('react-native');
    return function MockMarkdown({ value }: { value: string }) {
        mockMarkdownRender(value);
        return React.createElement(RNText, { testID: 'markdown' }, value);
    };
});

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: () => null,
}));

function hasEmptyTextChild(node: unknown): boolean {
    if (node === '') return true;
    if (!node || typeof node !== 'object') return false;

    const children = (node as { children?: unknown[] }).children;
    return Array.isArray(children) && children.some(hasEmptyTextChild);
}

describe('ChatMessage streaming visibility', () => {
    beforeEach(() => {
        mockMarkdownRender.mockClear();
    });

    it('renders user messages with warm user text colors', () => {
        const { getByText } = render(<ChatMessage text="mine" />);

        expect(getByText('mine').props.className).toContain(
            'text-user-text dark:text-user-text-dark'
        );
    });

    it('shows typing indicator before streamed chunks arrive', () => {
        const { getByTestId } = render(
            <ChatMessage isAi text="" isStreaming={true} />
        );

        expect(getByTestId('typing-indicator')).toBeTruthy();
    });

    it('shows streamed reasoning when content has not started', () => {
        const { queryByTestId, getByText } = render(
            <ChatMessage isAi text="" reasoning="1. thinking." isStreaming={true} />
        );

        expect(queryByTestId('typing-indicator')).toBeNull();
        expect(getByText('AI reasoning (live)')).toBeTruthy();
        expect(getByText('1. thinking.')).toBeTruthy();
        expect(mockMarkdownRender).not.toHaveBeenCalled();
    });

    it('renders streamed text while streaming is active', () => {
        const { queryByTestId, getByText, rerender } = render(
            <ChatMessage isAi text="" isStreaming={true} />
        );

        rerender(<ChatMessage isAi text="stream" isStreaming={true} />);

        expect(queryByTestId('typing-indicator')).toBeNull();
        expect(getByText('stream')).toBeTruthy();
        expect(mockMarkdownRender).not.toHaveBeenCalled();
    });

    it('renders completed plain AI prose without markdown', () => {
        const { getByText, queryByTestId } = render(
            <ChatMessage isAi text="Plain answer." />
        );

        expect(getByText('Plain answer.')).toBeTruthy();
        expect(queryByTestId('markdown')).toBeNull();
        expect(mockMarkdownRender).not.toHaveBeenCalled();
    });

    it('does not render empty reasoning as a raw child', () => {
        const { toJSON } = render(<ChatMessage isAi text="Plain answer." reasoning="" />);

        expect(hasEmptyTextChild(toJSON())).toBe(false);
    });

    it('renders completed AI text through markdown', () => {
        const { getByTestId } = render(<ChatMessage isAi text="**done**" />);

        expect(getByTestId('markdown')).toBeTruthy();
        expect(mockMarkdownRender).toHaveBeenCalledWith('**done**');
    });
});
