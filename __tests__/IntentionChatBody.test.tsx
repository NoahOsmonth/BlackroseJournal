import React, { createRef } from 'react';
import { ScrollView } from 'react-native';
import { render } from '@testing-library/react-native';

import { IntentionChatBody } from '../components/intentions/IntentionChatBody';
import type { InlineTypingInputRef } from '../components/InlineTypingInput';

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

describe('IntentionChatBody', () => {
    it('renders the flow label header without owning the composer', () => {
        const { getByText, queryByPlaceholderText } = render(
            <IntentionChatBody
                scrollViewRef={createRef<ScrollView>()}
                inputRef={createRef<InlineTypingInputRef>()}
                flowLabel="Intention Setting"
                headerDate="Fri, Jan 23"
                messages={[]}
                streamingMessage={null}
                isLoading={false}
                feedback={{}}
                onSubmitInput={jest.fn()}
                onInputTextChange={jest.fn()}
                onSettingsPress={jest.fn()}
                onPlay={jest.fn()}
                onCopy={jest.fn()}
                onShare={jest.fn()}
                onThumb={jest.fn()}
            />
        );

        expect(getByText(/Intention Setting/)).toBeTruthy();
        // The composer is pinned below the transcript by the screen, not here.
        expect(queryByPlaceholderText("Write what's true…")).toBeNull();
    });

    it('shows the Thinking indicator only when loading and no streaming message', () => {
        const { getByLabelText } = render(
            <IntentionChatBody
                scrollViewRef={createRef<ScrollView>()}
                inputRef={createRef<InlineTypingInputRef>()}
                flowLabel="Intention Setting"
                headerDate="Fri, Jan 23"
                messages={[]}
                streamingMessage={null}
                isLoading={true}
                feedback={{}}
                onSubmitInput={jest.fn()}
                onInputTextChange={jest.fn()}
                onSettingsPress={jest.fn()}
                onPlay={jest.fn()}
                onCopy={jest.fn()}
                onShare={jest.fn()}
                onThumb={jest.fn()}
            />
        );

        expect(getByLabelText('Blackrose is thinking')).toBeTruthy();

        const inputRef = createRef<InlineTypingInputRef>();
        const { queryByLabelText: q } = render(
            <IntentionChatBody
                scrollViewRef={createRef<ScrollView>()}
                inputRef={inputRef}
                flowLabel="Intention Setting"
                headerDate="Fri, Jan 23"
                messages={[]}
                streamingMessage={{ id: 's1', role: 'assistant', content: 'in flight', reasoning: '', isStreaming: true }}
                isLoading={true}
                feedback={{}}
                onSubmitInput={jest.fn()}
                onInputTextChange={jest.fn()}
                onSettingsPress={jest.fn()}
                onPlay={jest.fn()}
                onCopy={jest.fn()}
                onShare={jest.fn()}
                onThumb={jest.fn()}
            />
        );
        expect(q('Blackrose is thinking')).toBeNull();
    });

    it('renders streaming text with the customized AI chat color', () => {
        const { getByText } = render(
            <IntentionChatBody
                scrollViewRef={createRef<ScrollView>()}
                inputRef={createRef<InlineTypingInputRef>()}
                flowLabel="Intention Setting"
                headerDate="Fri, Jan 23"
                messages={[]}
                streamingMessage={{ id: 's1', role: 'assistant', content: 'in flight', reasoning: '', isStreaming: true }}
                isLoading={true}
                feedback={{}}
                onSubmitInput={jest.fn()}
                onInputTextChange={jest.fn()}
                onSettingsPress={jest.fn()}
                onPlay={jest.fn()}
                onCopy={jest.fn()}
                onShare={jest.fn()}
                onThumb={jest.fn()}
            />
        );

        expect(getByText('in flight').props.style.color).toBe('#89ABCD');
    });
});
