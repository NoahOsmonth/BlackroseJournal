import React, { createRef } from 'react';
import { ScrollView } from 'react-native';
import { render } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';

import { IntentionChatBody } from '../components/intentions/IntentionChatBody';

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: () => null,
}));

jest.mock('../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'dark',
}));

function classNameFor(node: ReactTestInstance): string {
    const className = node.props.className;
    return typeof className === 'string' ? className : '';
}

describe('IntentionChatBody', () => {
    it('renders the write input as a transparent borderless field', () => {
        const { getByTestId, getByText } = render(
            <IntentionChatBody
                scrollViewRef={createRef<ScrollView>()}
                headerDate="Fri, Jan 23"
                messages={[]}
                streamingMessage={null}
                feedback={{}}
                inputValue=""
                onInputChange={jest.fn()}
                onSettingsPress={jest.fn()}
                onPlay={jest.fn()}
                onCopy={jest.fn()}
                onShare={jest.fn()}
                onThumb={jest.fn()}
            />
        );

        expect(getByText('Intention Setting - Fri, Jan 23')).toBeTruthy();
        expect(classNameFor(getByTestId('intention-chat-input'))).toContain(
            'border-0 outline-none p-0'
        );
    });
});
