import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ChatMessage } from '../components/ChatMessage';
import type { AgentToolCallSnapshot } from '../services/ai/agentEvents';

const mockMarkdownRender = jest.fn();
const mockColorTheme = {
    colors: {
        accentLight: '#AA5500',
        accentDark: '#FFCC88',
        appTextLight: '#111827',
        appTextDark: '#F9FAFB',
        secondaryTextLight: '#6B7280',
        secondaryTextDark: '#9CA3AF',
        chatUserTextLight: '#445566',
        chatUserTextDark: '#DDEEFF',
        chatAiTextLight: '#123ABC',
        chatAiTextDark: '#89ABCD',
    },
};

jest.mock('@/hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

jest.mock('@/hooks/useThemeSettings', () => ({
    useThemeSettings: () => ({ colorTheme: mockColorTheme }),
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

const runningTool: AgentToolCallSnapshot = {
    toolCallId: 'c1',
    name: 'get_day',
    label: 'Reading a day',
    argsPreview: 'yesterday',
    status: 'running',
    round: 1,
};

const finishedTool: AgentToolCallSnapshot = {
    ...runningTool,
    status: 'ok',
    durationMs: 18,
    resultPreview: 'summary: Sleep',
};

describe('ChatMessage streaming visibility', () => {
    beforeEach(() => {
        mockMarkdownRender.mockClear();
    });

    it('renders user messages with warm user text colors', () => {
        const { getByText } = render(<ChatMessage text="mine" />);

        expect(getByText('mine').props.className).toContain(
            'text-user-text dark:text-user-text-dark'
        );
        expect(getByText('mine').props.style.color).toBe('#445566');
    });

    it('shows typing indicator before streamed chunks arrive', () => {
        const { getByTestId } = render(
            <ChatMessage isAi text="" isStreaming={true} />
        );

        expect(getByTestId('typing-indicator')).toBeTruthy();
    });

    it('shows streamed reasoning while the reply has not started', () => {
        const { queryByTestId, getByLabelText, getByText } = render(
            <ChatMessage isAi text="" reasoning="1. thinking." isStreaming={true} />
        );

        expect(getByLabelText('Companion reasoning')).toBeTruthy();
        expect(getByText('1. thinking.')).toBeTruthy();
        // Reasoning with no tools is already summarised — no separate Working line.
        expect(getByText('Thought it through')).toBeTruthy();
        expect(queryByTestId('typing-indicator')).toBeTruthy();
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
        expect(getByText('Plain answer.').props.style.color).toBe('#123ABC');
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

    it('opens the work rail while a tool runs and skips a second bare typing indicator', () => {
        const { getByLabelText, getAllByTestId } = render(
            <ChatMessage isAi text="" isStreaming toolActivity={[runningTool]} />
        );

        expect(getByLabelText('Tool Reading a day: running')).toBeTruthy();
        // One indicator only — the rail's Thinking footer, not ChatMessage's bare one.
        expect(getAllByTestId('typing-indicator')).toHaveLength(1);
    });

    it('folds a finished tool behind one summary line above completed prose', () => {
        const { getByText, queryByLabelText } = render(
            <ChatMessage isAi text="You talked about sleep." toolActivity={[finishedTool]} />
        );

        expect(getByText('Used 1 tool · 18ms')).toBeTruthy();
        expect(queryByLabelText('Tool Reading a day: ok')).toBeNull();
        expect(getByText('You talked about sleep.')).toBeTruthy();
    });

    it('expands the summary line into the tool that ran', () => {
        const { getByLabelText } = render(
            <ChatMessage isAi text="You talked about sleep." toolActivity={[finishedTool]} />
        );

        fireEvent.press(getByLabelText('Show thinking and tools'));
        expect(getByLabelText('Tool Reading a day: ok')).toBeTruthy();
    });

    it('shows the live working status line between tool batches', () => {
        const { getByText, queryAllByTestId } = render(
            <ChatMessage
                isAi
                text=""
                isStreaming
                toolActivity={[finishedTool]}
                statusLines={[{ id: 't1', round: 1, text: 'Let me go dig rather than guess.' }]}
            />
        );

        expect(getByText('Let me go dig rather than guess.')).toBeTruthy();
        // Status line counts as the working indicator — no bare typing indicator.
        expect(queryAllByTestId('typing-indicator')).toHaveLength(0);
    });

    it('drops status lines from a committed message even if passed in', () => {
        const { queryByText, getByText } = render(
            <ChatMessage
                isAi
                text="Yesterday was about sleep."
                toolActivity={[finishedTool]}
                statusLines={[{ id: 't1', round: 1, text: 'Let me go dig.' }]}
            />
        );

        expect(getByText('Used 1 tool · 18ms')).toBeTruthy();
        expect(queryByText('Let me go dig.')).toBeNull();
    });

    it('hides the whole work layer — reasoning, tools and summary — when thinking is off', () => {
        const { queryByLabelText, queryByText, getByText } = render(
            <ChatMessage
                isAi
                text="Yesterday was about sleep."
                toolActivity={[finishedTool]}
                reasoning="She sounded tired."
                showThinking={false}
            />
        );

        expect(queryByText('Used 1 tool · 18ms')).toBeNull();
        expect(queryByLabelText('Companion reasoning')).toBeNull();
        expect(queryByLabelText('Show thinking and tools')).toBeNull();
        expect(getByText('Yesterday was about sleep.')).toBeTruthy();
    });

    it('still shows the bare typing indicator on a live turn with thinking off', () => {
        const { getByTestId, queryByText } = render(
            <ChatMessage
                isAi
                text=""
                isStreaming
                toolActivity={[runningTool]}
                showThinking={false}
            />
        );

        expect(queryByText('Working…')).toBeNull();
        expect(getByTestId('typing-indicator')).toBeTruthy();
    });
});
