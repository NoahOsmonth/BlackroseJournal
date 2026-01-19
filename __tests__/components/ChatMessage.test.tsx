import { ChatMessage } from '@/components/ChatMessage';
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

jest.mock('@/hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: 'MaterialIcons',
}));

jest.mock('react-native-reanimated', () => {
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.default.call = () => { };
    return {
        ...Reanimated,
        FadeIn: {
            duration: () => ({ springify: () => ({}) }),
        },
        FadeInDown: {
            duration: () => ({ springify: () => ({}) }),
        },
        useSharedValue: (val: number) => ({ value: val }),
        useAnimatedStyle: () => ({}),
        withRepeat: (val: any) => val,
        withSequence: (val: any) => val,
        withTiming: (val: any) => val,
    };
});

describe('ChatMessage', () => {
    it('renders a user message', () => {
        const { getByText } = render(<ChatMessage text="Hello there" />);
        expect(getByText('Hello there')).toBeTruthy();
    });

    it('toggles reasoning for AI messages', () => {
        const { getByText, queryByText } = render(
            <ChatMessage text="AI reply" isAi reasoning="Because." />
        );

        expect(getByText('AI reply')).toBeTruthy();
        expect(queryByText('AI Reasoning')).toBeNull();

        fireEvent.press(getByText('View AI reasoning'));
        expect(getByText('AI Reasoning')).toBeTruthy();
        expect(getByText('Because.')).toBeTruthy();

        fireEvent.press(getByText('Hide reasoning'));
        expect(queryByText('AI Reasoning')).toBeNull();
    });

    it('does not allow reasoning toggle while streaming', () => {
        const { queryByText } = render(
            <ChatMessage text="Streaming" isAi reasoning="Because." isStreaming />
        );

        expect(queryByText('View AI reasoning')).toBeNull();
    });
});
