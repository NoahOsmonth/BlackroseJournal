import React from 'react';
import { render } from '@testing-library/react-native';

import { IntentionChatMessage } from '../components/intentions/IntentionChatMessage';
import {
    DEFAULT_INTENTION_OPENING_PROMPT,
    INTENTION_START_TRIGGER_TEXT,
} from '../constants/intentionChat';
import type { Message } from '../services/ai/ai';

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

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: () => null,
}));

jest.mock('@/hooks/use-color-scheme', () => ({
    useColorScheme: () => 'dark',
}));

jest.mock('@/hooks/useThemeSettings', () => ({
    useThemeSettings: () => ({ colorTheme: mockColorTheme }),
}));

describe('IntentionChatMessage', () => {
    it('renders the reference opening prompt instead of the internal start trigger', () => {
        const message: Message = {
            id: 'message-1',
            role: 'assistant',
            content: INTENTION_START_TRIGGER_TEXT,
            timestamp: 0,
        };

        const { getByTestId, getByText, queryByText } = render(
            <IntentionChatMessage
                message={message}
                onPlay={jest.fn()}
                onCopy={jest.fn()}
                onShare={jest.fn()}
                onThumb={jest.fn()}
            />
        );

        expect(getByText(DEFAULT_INTENTION_OPENING_PROMPT)).toBeTruthy();
        expect(queryByText(INTENTION_START_TRIGGER_TEXT)).toBeNull();
        expect(getByTestId('intention-chat-message-text').props.className).toContain(
            'max-w-[320px]'
        );
        expect(getByTestId('intention-chat-message-text').props.style.color).toBe('#89ABCD');
    });

    it('renders user intention messages with warm user text colors', () => {
        const message: Message = {
            id: 'message-2',
            role: 'user',
            content: 'I want a calmer morning.',
            timestamp: 0,
        };

        const { getByTestId } = render(
            <IntentionChatMessage
                message={message}
                onPlay={jest.fn()}
                onCopy={jest.fn()}
                onShare={jest.fn()}
                onThumb={jest.fn()}
            />
        );

        expect(getByTestId('intention-chat-message-text').props.className).toContain(
            'text-user-text dark:text-user-text-dark'
        );
        expect(getByTestId('intention-chat-message-text').props.style.color).toBe('#DDEEFF');
    });
});
