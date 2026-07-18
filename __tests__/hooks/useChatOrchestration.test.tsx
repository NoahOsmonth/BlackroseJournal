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

jest.mock('../../hooks/settings/useGenerationSettings', () => ({
    useGenerationSettings: () => ({
        settings: { temperature: 1, topP: 0.95, maxTokens: 32_768 },
        modelContext: null,
        contextError: null,
        isLoading: false,
        update: jest.fn(),
        reset: jest.fn(),
        refreshContext: jest.fn(),
    }),
}));

jest.mock('../../services/ai', () => {
    const setSystemPrompt = jest.fn();
    const sendInitialMessage = jest.fn();
    const sendInitialPrompt = jest.fn();
    const sendMessage = jest.fn();
    const setMessages = jest.fn();
    const setConversationId = jest.fn();
    const setGenerationSettings = jest.fn();
    const clearMessages = jest.fn();

    const useChat = jest.fn(() => ({
        setSystemPrompt,
        sendInitialMessage,
        sendInitialPrompt,
        sendMessage,
        setMessages,
        setConversationId,
        setGenerationSettings,
        clearMessages,
    }));
    (useChat as jest.Mock & { __mockSetSystemPrompt: jest.Mock }).__mockSetSystemPrompt = setSystemPrompt;

    return {
        __esModule: true,
        useChat,
    };
});

import { FLOWS, useChatOrchestration } from '../../features/chat';
import { THERAPIST_SYSTEM_PROMPT } from '../../constants/aiPrompts';
import { useChat } from '../../services/ai';
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

function InitialPromptHarness({
    initialPrompt,
}: {
    initialPrompt: { systemPrompt: string; triggerText: string };
}) {
    const scrollViewRef = useRef<ScrollView | null>(null);
    const inputRef = useRef<InlineTypingInputRef | null>(null);

    useChatOrchestration({
        scrollViewRef,
        inputRef,
        initialPrompt,
        flow: FLOWS.freeform,
    });

    return null;
}

describe('useChatOrchestration scroll behavior', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
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

describe('useChatOrchestration initialPrompt + flow', () => {
    const setSystemPrompt = (useChat as jest.Mock & { __mockSetSystemPrompt: jest.Mock })
        .__mockSetSystemPrompt;
    const useChatMock = useChat as jest.Mock;
    const getSendInitialMessage = () => useChatMock.mock.results.at(-1)?.value.sendInitialMessage as jest.Mock;
    const getSetMessages = () => useChatMock.mock.results.at(-1)?.value.setMessages as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('prepends the topic instruction to the freeform flow system prompt', () => {
        const topic = 'Burnout at work';
        const initialPrompt = {
            systemPrompt: `The user tapped an insight about this topic. Begin by gently exploring it with them, building on their journal entries.\n\nTopic: ${topic}`,
            triggerText: topic,
        };

        render(<InitialPromptHarness initialPrompt={initialPrompt} />);

        expect(setSystemPrompt).toHaveBeenCalledWith(
            expect.stringContaining(initialPrompt.systemPrompt)
        );
        expect(setSystemPrompt).toHaveBeenCalledWith(
            expect.stringContaining(THERAPIST_SYSTEM_PROMPT)
        );
        expect(getSendInitialMessage()).toHaveBeenCalled();
    });

    it('seeds static flow openers without calling the AI', () => {
        function EveningHarness() {
            const scrollViewRef = useRef<ScrollView | null>(null);
            const inputRef = useRef<InlineTypingInputRef | null>(null);
            useChatOrchestration({
                scrollViewRef,
                inputRef,
                initialPrompt: {
                    systemPrompt: 'guided',
                    triggerText: '[Start intention check-in]',
                },
                flow: FLOWS.evening,
            });
            return null;
        }

        render(<EveningHarness />);

        expect(getSendInitialMessage()).not.toHaveBeenCalled();
        expect(getSetMessages()).toHaveBeenCalledWith(
            [
                expect.objectContaining({
                    role: 'assistant',
                    content: expect.stringContaining("Let's gently look back"),
                }),
            ],
            expect.any(String)
        );
    });
});
