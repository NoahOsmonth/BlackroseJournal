/* eslint-disable import/first */

import React, { useEffect, useRef } from 'react';
import { render, act } from '@testing-library/react-native';
import type { ScrollView } from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
    },
}));

jest.mock('../../services/ai/sessionStorage', () => ({
    __esModule: true,
    saveSession: jest.fn(() => Promise.resolve()),
    removeSession: jest.fn(() => Promise.resolve()),
    pruneStaleSessions: jest.fn(() => Promise.resolve([])),
}));

jest.mock('../../hooks/settings/useGenerationSettings', () => ({
    useGenerationSettings: () => ({
        settings: { temperature: 1, topP: 0.9, maxTokens: 32_768 },
        modelContext: null,
        contextError: null,
        isLoading: false,
        update: jest.fn(),
        reset: jest.fn(),
        refreshContext: jest.fn(),
    }),
}));

import { useChatOrchestration } from '../../features/chat';
import type { ChatPersistOptions } from '../../features/chat';
import type { InlineTypingInputRef } from '../../components/InlineTypingInput';
import {
    pruneStaleSessions,
    removeSession,
    saveSession,
} from '../../services/ai/sessionStorage';

type HookResult = ReturnType<typeof useChatOrchestration>;

const PERSIST: ChatPersistOptions = {
    conversationId: 'chat_test',
    mode: 'freeform',
};

function Harness({ expose }: { expose: (result: HookResult) => void }) {
    const scrollViewRef = useRef<ScrollView | null>(
        { scrollToEnd: jest.fn() } as unknown as ScrollView
    );
    const inputRef = useRef<InlineTypingInputRef | null>(null);
    const result = useChatOrchestration({ scrollViewRef, inputRef, persist: PERSIST });

    useEffect(() => {
        expose(result);
    }, [expose, result]);

    return null;
}

describe('useChatOrchestration session autosave', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        (saveSession as jest.Mock).mockClear();
        (removeSession as jest.Mock).mockClear();
        (pruneStaleSessions as jest.Mock).mockClear();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('prunes stale sessions once on mount when persisting', () => {
        render(<Harness expose={() => undefined} />);
        expect(pruneStaleSessions).toHaveBeenCalledTimes(1);
    });

    it('debounces saveSession after a message is appended', () => {
        let result: HookResult | undefined;
        render(<Harness expose={(next) => { result = next; }} />);

        expect(saveSession).not.toHaveBeenCalled();

        act(() => {
            result?.initializeMessages([
                { id: '1', role: 'user', content: 'hello', timestamp: 1 },
            ]);
        });

        // Not saved before the debounce window elapses.
        act(() => {
            jest.advanceTimersByTime(400);
        });
        expect(saveSession).not.toHaveBeenCalled();

        // Saved once the 600ms debounce window passes.
        act(() => {
            jest.advanceTimersByTime(300);
        });
        expect(saveSession).toHaveBeenCalledTimes(1);
        expect(saveSession).toHaveBeenCalledWith(
            expect.objectContaining({
                conversationId: 'chat_test',
                mode: 'freeform',
                messages: expect.arrayContaining([
                    expect.objectContaining({ content: 'hello' }),
                ]),
            })
        );
    });

    it('does not save when there are no messages', () => {
        render(<Harness expose={() => undefined} />);
        act(() => {
            jest.advanceTimersByTime(1000);
        });
        expect(saveSession).not.toHaveBeenCalled();
    });

    it('clearPersistedSession removes the active conversation', async () => {
        let result: HookResult | undefined;
        render(<Harness expose={(next) => { result = next; }} />);

        await act(async () => {
            await result?.clearPersistedSession();
        });

        expect(removeSession).toHaveBeenCalledWith('chat_test');
    });

    it('stops autosaving after handleNewChat empties the conversation', () => {
        let result: HookResult | undefined;
        render(<Harness expose={(next) => { result = next; }} />);

        act(() => {
            result?.initializeMessages([
                { id: '1', role: 'user', content: 'first', timestamp: 1 },
            ]);
        });
        act(() => {
            jest.advanceTimersByTime(700);
        });
        expect(saveSession).toHaveBeenCalledTimes(1);

        act(() => {
            result?.handleNewChat();
        });
        act(() => {
            jest.advanceTimersByTime(700);
        });

        // handleNewChat empties messages, so no further autosave fires.
        expect(saveSession).toHaveBeenCalledTimes(1);
    });
});
