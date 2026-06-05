import React from 'react';
import { render } from '@testing-library/react-native';

import { IntentionChatMessage } from '../components/intentions/IntentionChatMessage';
import {
    DEFAULT_INTENTION_OPENING_PROMPT,
    INTENTION_START_TRIGGER_TEXT,
} from '../constants/intentionChat';
import type { Message } from '../services/ai/ai';

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: () => null,
}));

jest.mock('../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'dark',
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
    });
});
