/* eslint-disable import/first */
/**
 * RED coverage for the intention check-in finish-flow UX defects.
 *
 * These tests encode the corrected behavior the parent will implement; they
 * are expected to FAIL against the current source. The exact user-facing
 * strings are the contract for `notifyUser`.
 *
 * Contract:
 *   Close draft failure  -> ('Could not save your draft', 'Your chat is still here. Please try again.')
 *   Finish save failure  -> ('Could not save your check-in', 'Your words are still here. Please try again.')
 */
import { act, renderHook } from '@testing-library/react-native';

jest.mock('expo-router', () => {
    const replace = jest.fn();
    return { useRouter: () => ({ replace }), __replace: replace };
});

jest.mock('@/services/ai', () => {
    const generateEntryTitle = jest.fn();
    return { generateEntryTitle, __generateEntryTitle: generateEntryTitle };
});

// hooks/journal/useEntryUtils has a value-shaped type import of this module.
jest.mock('@/services/ai/ai', () => ({}));

jest.mock('@/services/intentions/intentionChatCompletion', () => {
    const saveIntentionChatDraft = jest.fn();
    const finishIntentionChat = jest.fn();
    const shouldMarkIntentionGoalComplete = jest.fn(() => false);
    return {
        saveIntentionChatDraft,
        finishIntentionChat,
        shouldMarkIntentionGoalComplete,
        __saveIntentionChatDraft: saveIntentionChatDraft,
        __finishIntentionChat: finishIntentionChat,
        __shouldMarkIntentionGoalComplete: shouldMarkIntentionGoalComplete,
    };
});

jest.mock('@/services/goals/goalsStorage', () => {
    const markIntentionGoalComplete = jest.fn().mockResolvedValue({});
    return {
        markIntentionGoalComplete,
        __markIntentionGoalComplete: markIntentionGoalComplete,
    };
});

jest.mock('@/components/ui/webConfirm', () => {
    const notifyUser = jest.fn();
    return {
        notifyUser,
        webConfirm: jest.fn(),
        webNotify: jest.fn(),
        __notifyUser: notifyUser,
    };
});

import { useIntentionChatFinish } from '../../hooks/intentions/useIntentionChatFinish';

const mockReplace = (jest.requireMock('expo-router') as { __replace: jest.Mock }).__replace;
const mockGenerateEntryTitle = (jest.requireMock('@/services/ai') as { __generateEntryTitle: jest.Mock }).__generateEntryTitle;
const mockSaveIntentionChatDraft = (jest.requireMock('@/services/intentions/intentionChatCompletion') as { __saveIntentionChatDraft: jest.Mock }).__saveIntentionChatDraft;
const mockFinishIntentionChat = (jest.requireMock('@/services/intentions/intentionChatCompletion') as { __finishIntentionChat: jest.Mock }).__finishIntentionChat;
const mockShouldMarkIntentionGoalComplete = (jest.requireMock('@/services/intentions/intentionChatCompletion') as { __shouldMarkIntentionGoalComplete: jest.Mock }).__shouldMarkIntentionGoalComplete;
const mockMarkIntentionGoalComplete = (jest.requireMock('@/services/goals/goalsStorage') as { __markIntentionGoalComplete: jest.Mock }).__markIntentionGoalComplete;
const mockNotifyUser = (jest.requireMock('@/components/ui/webConfirm') as { __notifyUser: jest.Mock }).__notifyUser;

const messages = [
    { id: 'm1', role: 'user' as const, content: 'This morning I felt hopeful.', timestamp: 1 },
];
const successfulFinish = {
    resolvedIntention: null,
    finalMessages: messages,
    summary: 'This morning I felt hopeful.',
    checkIn: null,
};

function createDeps() {
    const finalize = jest.fn();
    const clearPersistedSession = jest.fn().mockResolvedValue(undefined);
    const removeSession = jest.fn().mockResolvedValue(undefined);
    const handleNewChat = jest.fn();
    const onDraftSaved = jest.fn();
    const options = {
        messages,
        inputValue: '',
        conversationId: 'chat-morning-1',
        checkInType: 'morning' as const,
        draftCheckInId: null,
        intentionId: undefined,
        intention: null,
        areaParam: undefined,
        personaId: undefined,
        isRefineMode: false,
        finalize,
        clearPersistedSession,
        removeSession,
        handleNewChat,
        onDraftSaved,
    };
    return {
        options,
        finalize,
        clearPersistedSession,
        removeSession,
        handleNewChat,
        onDraftSaved,
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateEntryTitle.mockReset().mockResolvedValue('A gentle title');
    mockSaveIntentionChatDraft.mockReset().mockResolvedValue('draft-1');
    mockFinishIntentionChat.mockReset().mockResolvedValue(successfulFinish);
    mockShouldMarkIntentionGoalComplete.mockReset().mockReturnValue(false);
    mockMarkIntentionGoalComplete.mockReset().mockResolvedValue({});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('useIntentionChatFinish — failed saves are visible and retryable', () => {
    it('tells the writer a Close draft save failed and keeps the chat so Close can be tried again', async () => {
        const deps = createDeps();
        mockSaveIntentionChatDraft
            .mockRejectedValueOnce(new Error('storage unavailable'))
            .mockResolvedValueOnce('draft-1');
        const { result } = renderHook(() => useIntentionChatFinish(deps.options));

        let rejection: unknown;
        await act(async () => {
            try {
                await result.current.handleClose();
            } catch (error) {
                rejection = error;
            }
        });

        expect(mockNotifyUser).toHaveBeenCalledWith(
            'Could not save your draft',
            'Your chat is still here. Please try again.',
        );
        expect(rejection).toBeUndefined(); // no unhandled rejection escapes to the UI
        expect(deps.onDraftSaved).not.toHaveBeenCalled();
        expect(deps.clearPersistedSession).not.toHaveBeenCalled();
        expect(deps.handleNewChat).not.toHaveBeenCalled();
        expect(mockReplace).not.toHaveBeenCalled();
        expect(result.current.isSaving).toBe(false);

        // The words are still here: a second Close must save and navigate.
        await act(async () => {
            await result.current.handleClose();
        });
        expect(mockSaveIntentionChatDraft).toHaveBeenCalledTimes(2);
        expect(deps.onDraftSaved).toHaveBeenCalledWith('draft-1');
        expect(deps.clearPersistedSession).toHaveBeenCalledTimes(1);
        expect(deps.handleNewChat).toHaveBeenCalledTimes(1);
        expect(mockReplace).toHaveBeenCalledWith('/(tabs)/today');
    });

    it('tells the writer a Finish save failed and still saves and navigates on retry', async () => {
        const deps = createDeps();
        mockFinishIntentionChat
            .mockRejectedValueOnce(new Error('storage unavailable'))
            .mockResolvedValueOnce(successfulFinish);
        const { result } = renderHook(() => useIntentionChatFinish(deps.options));

        let rejection: unknown;
        await act(async () => {
            try {
                await result.current.handleFinish();
            } catch (error) {
                rejection = error;
            }
        });

        expect(mockNotifyUser).toHaveBeenCalledWith(
            'Could not save your check-in',
            'Your words are still here. Please try again.',
        );
        expect(rejection).toBeUndefined(); // the failed save must not throw out of Finish
        expect(deps.removeSession).not.toHaveBeenCalled();
        expect(deps.handleNewChat).not.toHaveBeenCalled();
        expect(mockReplace).not.toHaveBeenCalled();
        expect(mockMarkIntentionGoalComplete).not.toHaveBeenCalled();
        expect(result.current.isSaving).toBe(false);

        // A ref-based lock must release after failure, so Finish still works.
        await act(async () => {
            await result.current.handleFinish();
        });
        expect(mockFinishIntentionChat).toHaveBeenCalledTimes(2);
        expect(deps.removeSession).toHaveBeenCalledWith('chat-morning-1');
        expect(deps.handleNewChat).toHaveBeenCalledTimes(1);
        expect(mockReplace).toHaveBeenCalledWith('/(tabs)/today');
        expect(result.current.isSaving).toBe(false);
    });

    it('finishes the check-in only once when Finish is pressed twice before the save settles', async () => {
        const deps = createDeps();
        let release!: (value: typeof successfulFinish) => void;
        const pendingFinish = new Promise<typeof successfulFinish>((resolve) => {
            release = resolve;
        });
        mockFinishIntentionChat.mockReturnValue(pendingFinish);
        const { result } = renderHook(() => useIntentionChatFinish(deps.options));

        let firstPress!: Promise<void>;
        let secondPress!: Promise<void>;
        act(() => {
            firstPress = result.current.handleFinish();
            secondPress = result.current.handleFinish();
        });

        release(successfulFinish);
        await act(async () => {
            await Promise.all([firstPress, secondPress]);
        });

        expect(mockFinishIntentionChat).toHaveBeenCalledTimes(1);
        expect(mockReplace).toHaveBeenCalledWith('/(tabs)/today');
        expect(result.current.isSaving).toBe(false);
    });


    it('saves one draft when Close is pressed twice before the save settles', async () => {
        const deps = createDeps();
        let release!: (value: string) => void;
        mockSaveIntentionChatDraft.mockReturnValue(
            new Promise<string>((resolve) => { release = resolve; }),
        );
        const { result } = renderHook(() => useIntentionChatFinish(deps.options));

        let firstPress!: Promise<void>;
        let secondPress!: Promise<void>;
        act(() => {
            firstPress = result.current.handleClose();
            secondPress = result.current.handleClose();
        });

        release('draft-1');
        await act(async () => { await Promise.all([firstPress, secondPress]); });

        expect(mockSaveIntentionChatDraft).toHaveBeenCalledTimes(1);
        expect(deps.onDraftSaved).toHaveBeenCalledTimes(1);
        expect(deps.clearPersistedSession).toHaveBeenCalledTimes(1);
        expect(deps.handleNewChat).toHaveBeenCalledTimes(1);
        expect(mockReplace).toHaveBeenCalledTimes(1);
    });

    it('bounds the AI title call so a stalled title cannot hold Finish open', async () => {
        jest.useFakeTimers();
        try {
            const deps = createDeps();
            mockGenerateEntryTitle.mockReturnValue(new Promise<string>(() => {}));
            const { result } = renderHook(() => useIntentionChatFinish(deps.options));

            await act(async () => { void result.current.handleFinish(); });
            await act(async () => { await jest.advanceTimersByTimeAsync(8_000); });

            expect(mockFinishIntentionChat).toHaveBeenCalledTimes(1);
            expect(mockFinishIntentionChat.mock.calls[0][0]).toEqual(
                expect.objectContaining({ title: undefined }),
            );
            expect(mockReplace).toHaveBeenCalledWith('/(tabs)/today');
            expect(result.current.isSaving).toBe(false);
        } finally {
            jest.useRealTimers();
        }
    });
});
