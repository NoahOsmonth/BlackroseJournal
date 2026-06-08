/* eslint-disable import/first */

import React, { useEffect, useRef } from 'react';
import { render, act } from '@testing-library/react-native';
import type { NativeSyntheticEvent, NativeScrollEvent, ScrollView } from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
    },
}));

import { useChatOrchestration } from '../../features/chat';
import type { InlineTypingInputRef } from '../../components/InlineTypingInput';

type HookResult = ReturnType<typeof useChatOrchestration>;

function makeScrollEvent(
    y: number,
    contentHeight: number,
    viewportHeight: number
): NativeSyntheticEvent<NativeScrollEvent> {
    return {
        nativeEvent: {
            contentOffset: { x: 0, y },
            contentSize: { width: 0, height: contentHeight },
            layoutMeasurement: { width: 0, height: viewportHeight },
        },
    } as NativeSyntheticEvent<NativeScrollEvent>;
}

function Harness({ expose, scrollToEnd }: {
    expose: (result: HookResult) => void;
    scrollToEnd: jest.Mock;
}) {
    const scrollViewRef = useRef<ScrollView | null>({ scrollToEnd } as unknown as ScrollView);
    const inputRef = useRef<InlineTypingInputRef | null>(null);
    const result = useChatOrchestration({ scrollViewRef, inputRef });

    useEffect(() => {
        expose(result);
    }, [expose, result]);

    return null;
}

describe('useChatOrchestration scroll behavior', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('does not force streaming auto-scroll after the user scrolls away from bottom', () => {
        let result: HookResult | undefined;
        const scrollToEnd = jest.fn();
        render(<Harness expose={(next) => { result = next; }} scrollToEnd={scrollToEnd} />);

        act(() => {
            result?.handleScroll(makeScrollEvent(0, 1000, 300));
            result?.scrollToBottom();
            jest.advanceTimersByTime(120);
        });

        expect(scrollToEnd).not.toHaveBeenCalled();

        act(() => {
            result?.handleScroll(makeScrollEvent(680, 1000, 300));
            result?.scrollToBottom();
            jest.advanceTimersByTime(120);
        });

        expect(scrollToEnd).toHaveBeenCalledWith({ animated: true });
    });
});
