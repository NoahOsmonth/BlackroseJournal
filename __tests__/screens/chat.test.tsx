/* eslint-disable import/first */

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

const mockUseChatOrchestration = jest.fn();
const mockReplace = jest.fn();
const mockBuildLocalMemoryContext = jest.fn(
    async (_opts?: { query?: string }) => '## Memory capsule',
);
const mockCreateEntry = jest.fn(async () => ({
    id: 'entry-1',
    title: 'Test',
    emoji: '📝',
    messages: [],
    status: 'completed',
    createdAt: 1,
    updatedAt: 1,
}));
const mockUpdateEntry = jest.fn(async () => ({
    id: 'entry-1',
    title: 'Test',
    emoji: '📝',
    messages: [],
    status: 'completed',
    createdAt: 1,
    updatedAt: 1,
}));

jest.mock('expo-router', () => ({
    useRouter: () => ({ replace: mockReplace }),
    useLocalSearchParams: () => ({}),
}));

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: { children: React.ReactNode }) => {
        const { View } = jest.requireActual('react-native');
        return <View>{children}</View>;
    },
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('../../hooks/settings/useChatModelPicker', () => ({
    useChatModelPicker: () => ({
        visible: false,
        open: jest.fn(),
        close: jest.fn(),
        models: [],
        recentModels: [],
        selectedModelId: null,
        freeOnly: true,
        hostLabel: 'openrouter.ai',
        hasApiKey: true,
        isLoading: false,
        isFetching: false,
        error: null,
        selectModel: jest.fn(),
        refreshModels: jest.fn(),
        openSettings: jest.fn(),
    }),
}));

jest.mock('../../components/ai/ChatModelPickerSheet', () => ({
    ChatModelPickerSheet: () => null,
}));

jest.mock('../../components/ChatMessage', () => ({
    ChatMessage: () => null,
}));

jest.mock('../../components/FooterActions', () => {
    const ReactActual = jest.requireActual('react') as typeof import('react');
    const { Pressable, Text } = jest.requireActual('react-native') as typeof import('react-native');
    return {
        FooterActions: (props: { onFinishEntry?: () => void }) => (
            <Pressable
                accessibilityLabel="test-finish-entry"
                onPress={() => props.onFinishEntry?.()}
            >
                <Text>finish</Text>
            </Pressable>
        ),
    };
});

jest.mock('../../components/Header', () => ({
    Header: () => null,
}));

/**
 * Real send path: ChatScreen wires onSubmit={handleSendMessage}.
 * Expose a pressable so tests can submit user text without the real input.
 */
jest.mock('../../components/InlineTypingInput', () => {
    const ReactActual = jest.requireActual('react') as typeof import('react');
    const { Pressable, Text } = jest.requireActual('react-native') as typeof import('react-native');
    return {
        InlineTypingInput: ReactActual.forwardRef(function MockInlineTypingInput(
            props: { onSubmit?: (text: string) => void },
            _ref: unknown,
        ) {
            return (
                <Pressable
                    accessibilityLabel="test-send-user-message"
                    onPress={() => props.onSubmit?.('My manager keeps moving the goalposts')}
                >
                    <Text>send</Text>
                </Pressable>
            );
        }),
    };
});

jest.mock('../../components/personas/ChatPersonaSheet', () => ({
    ChatPersonaSheet: () => null,
}));

jest.mock('../../components/ui/TypingIndicator', () => ({
    TypingIndicator: () => null,
}));

/**
 * Stateful orchestration mock: handleSendMessage appends a real user message so
 * ChatScreen's useEffect(latestUserMemoryQuery(messages)) can fire.
 * What would make the PR5 test fail: if ChatScreen never re-derives capsule query
 * from messages (e.g. deleted useEffect / always passes continuedEntry?.title only).
 */
jest.mock('../../features/chat', () => {
    const ReactActual = jest.requireActual('react') as typeof import('react');
    return {
        FLOWS: {
            freeform: { id: 'freeform' },
            continue: { id: 'continue' },
        },
        useChatOrchestration: (opts: unknown) => {
            mockUseChatOrchestration(opts);
            const [messages, setMessages] = ReactActual.useState<
                { id: string; role: string; content: string; timestamp: number }[]
            >([]);
            return {
                messages,
                streamingMessage: null,
                isLoading: false,
                errorMessage: null,
                canRetry: false,
                handleSendMessage: async (text: string) => {
                    setMessages((prev) => [
                        ...prev,
                        {
                            id: `user-${prev.length + 1}`,
                            role: 'user',
                            content: text,
                            timestamp: Date.now(),
                        },
                    ]);
                },
                retryLastMessage: jest.fn(),
                clearError: jest.fn(),
                handleNewChat: jest.fn(),
                initializeMessages: jest.fn(),
                clearPersistedSession: jest.fn(),
                scrollToBottom: jest.fn(),
                handleScroll: jest.fn(),
            };
        },
        useChatSessionFlush: () => ({ finalize: jest.fn() }),
        useResumeChatSession: () => {},
    };
});

jest.mock('../../hooks/feedback/useAiFeedback', () => ({
    useAiFeedback: () => ({ guidance: 'feedback' }),
}));

jest.mock('../../hooks/goals/useGoalsContext', () => ({
    useGoalsContext: () => ({ goalsContext: "## User's Current Goals and Habits\n- Test goal" }),
}));

// Real useLocalMemoryContext runs — only retrieval is stubbed.
jest.mock('../../hooks/memory/useIdentityContext', () => ({
    useIdentityContext: () => ({ context: '## Identity\n- Preferred name: Test' }),
}));

jest.mock('../../hooks/memory/useRecentDaysContext', () => ({
    useRecentDaysContext: () => ({ context: '## Recent day digests\n- 2026-07-12: demo' }),
}));

jest.mock('../../hooks/personas/usePersonas', () => ({
    usePersonas: () => ({ personas: [], activePersona: null, setActive: jest.fn() }),
}));

jest.mock('../../hooks/useJournalEntries', () => ({
    useJournalEntries: () => ({
        create: mockCreateEntry,
        update: mockUpdateEntry,
        getById: jest.fn(async () => null),
    }),
}));

jest.mock('../../services/ai', () => ({
    generateEntryTitle: jest.fn(async () => 'Test title'),
    generateEntryAnalysis: jest.fn(),
}));

jest.mock('../../services/memory/localMemory', () => ({
    saveJournalEntryMemories: jest.fn(),
    subscribeMemoryChanges: jest.fn(() => () => undefined),
    buildLocalMemoryContext: (opts?: { query?: string }) => mockBuildLocalMemoryContext(opts),
}));

jest.mock('../../services/memory/dayDigestStorage', () => ({
    upsertJournalDayDigest: jest.fn(),
    buildRecentDaysContext: jest.fn(async () => undefined),
}));

jest.mock('../../services/memory/identityExtraction', () => ({
    extractIdentityFromSessionTranscript: jest.fn(async () => null),
}));

jest.mock('../../services/journal/journalFinishSideEffects', () => ({
    runJournalFinishSideEffects: jest.fn(async () => undefined),
    runJournalFinishBackground: jest.fn(() => ({
        runId: 'finish-test',
        promise: Promise.resolve(),
    })),
}));

import ChatScreen from '../../app/chat';

function queriesPassedToCapsule(): Array<string | undefined> {
    return mockBuildLocalMemoryContext.mock.calls.map((call) => {
        const opts = call[0] as { query?: string } | undefined;
        return opts?.query;
    });
}

describe('ChatScreen', () => {
    beforeEach(() => {
        mockUseChatOrchestration.mockClear();
        mockBuildLocalMemoryContext.mockClear();
        mockBuildLocalMemoryContext.mockResolvedValue('## Memory capsule');
    });

    it('passes goalsContext to useChatOrchestration flowContext', () => {
        render(<ChatScreen />);

        expect(mockUseChatOrchestration).toHaveBeenCalled();
        const call = mockUseChatOrchestration.mock.calls[0][0] as {
            flowContext: { goalsContext: string };
        };
        expect(call.flowContext.goalsContext).toBe(
            "## User's Current Goals and Habits\n- Test goal",
        );
    });

    /**
     * PR5 proof: capsule retrieval query is driven by live session user text.
     * What specific code change would make this test fail?
     * - Revert app/chat.tsx to `useLocalMemoryContext({ query: continuedEntry?.title })`
     *   only (ignore messages), or delete the messages→latestUserText useEffect, or
     *   stop calling resolveMemoryCapsuleQuery / latestUserMemoryQuery with user content.
     * Those would leave query undefined after send; this test asserts the post-send query
     * equals the submitted user text.
     */
    it('re-ranks the memory capsule with the latest user message after send', async () => {
        const userText = 'My manager keeps moving the goalposts';
        const screen = render(<ChatScreen />);

        await waitFor(() => {
            expect(mockBuildLocalMemoryContext).toHaveBeenCalled();
        });
        expect(queriesPassedToCapsule()).toContain(undefined);
        expect(queriesPassedToCapsule()).not.toContain(userText);

        await act(async () => {
            fireEvent.press(screen.getByLabelText('test-send-user-message'));
        });

        await waitFor(() => {
            expect(queriesPassedToCapsule()).toContain(userText);
        });

        // Last capsule load after send must use the live user text (not stay empty).
        const lastQuery = queriesPassedToCapsule().at(-1);
        expect(lastQuery).toBe(userText);
    });

    it('navigates to reflection immediately after saving, without awaiting background work', async () => {
        const { runJournalFinishBackground } = jest.requireMock(
            '../../services/journal/journalFinishSideEffects',
        ) as { runJournalFinishBackground: jest.Mock };
        const { generateEntryAnalysis } = jest.requireMock('../../services/ai') as {
            generateEntryAnalysis: jest.Mock;
        };
        // Background analysis would hang forever if awaited — the screen must
        // not block navigation on it.
        generateEntryAnalysis.mockReturnValue(new Promise(() => undefined));
        runJournalFinishBackground.mockClear();

        const screen = render(<ChatScreen />);
        await act(async () => {
            fireEvent.press(screen.getByLabelText('test-send-user-message'));
        });

        await act(async () => {
            fireEvent.press(screen.getByLabelText('test-finish-entry'));
        });

        // Navigation happened without waiting for the background run.
        expect(mockReplace).toHaveBeenCalledWith({
            pathname: '/entry-reflection',
            params: { entryId: 'entry-1' },
        });
        expect(runJournalFinishBackground).toHaveBeenCalledTimes(1);
    });

    it('saves the entry as completed before navigating (no analysis in the blocking path)', async () => {
        const { generateEntryAnalysis } = jest.requireMock('../../services/ai') as {
            generateEntryAnalysis: jest.Mock;
        };
        mockCreateEntry.mockClear();
        generateEntryAnalysis.mockClear();

        const screen = render(<ChatScreen />);
        await act(async () => {
            fireEvent.press(screen.getByLabelText('test-send-user-message'));
        });

        await act(async () => {
            fireEvent.press(screen.getByLabelText('test-finish-entry'));
        });

        // The blocking save path must not call the LLM analysis.
        expect(generateEntryAnalysis).not.toHaveBeenCalled();
        expect(mockCreateEntry).toHaveBeenCalledWith(expect.objectContaining({
            status: 'completed',
        }));
        expect(mockReplace).toHaveBeenCalledWith({
            pathname: '/entry-reflection',
            params: { entryId: 'entry-1' },
        });
    });
});
