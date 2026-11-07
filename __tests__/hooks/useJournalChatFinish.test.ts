/* eslint-disable import/first */
/**
 * RED coverage for the journal finish-flow UX defects.
 *
 * These tests encode the corrected behavior the parent will implement; they
 * are expected to FAIL against the current source. The exact user-facing
 * strings are the contract for `notifyUser`.
 *
 * Contract:
 *   Close draft failure  -> ('Could not save your draft', 'Your chat is still here. Please try again.')
 *   Finish save failure  -> ('Could not save your entry', 'Your words are still here. Please try again.')
 */
import { act, renderHook } from '@testing-library/react-native';

jest.mock('expo-router', () => {
    const replace = jest.fn();
    return { useRouter: () => ({ replace }), __replace: replace };
});

jest.mock('expo-haptics', () => {
    const notificationAsync = jest.fn(() => Promise.resolve());
    return {
        notificationAsync,
        NotificationFeedbackType: { Success: 'success' },
        __notificationAsync: notificationAsync,
    };
});

jest.mock('@/services/ai', () => {
    const generateEntryTitle = jest.fn();
    return { generateEntryTitle, __generateEntryTitle: generateEntryTitle };
});

// hooks/journal/useEntryUtils has a value-shaped type import of this module.
jest.mock('@/services/ai/ai', () => ({}));

jest.mock('@/services/journal/journalFinishSideEffects', () => {
    const runJournalFinishBackground = jest.fn(() => ({
        runId: 'run-1',
        promise: Promise.resolve(),
    }));
    return {
        runJournalFinishBackground,
        __runJournalFinishBackground: runJournalFinishBackground,
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

import { useJournalChatFinish } from '../../hooks/chat/useJournalChatFinish';

const mockReplace = (jest.requireMock('expo-router') as { __replace: jest.Mock }).__replace;
const mockNotificationAsync = (jest.requireMock('expo-haptics') as { __notificationAsync: jest.Mock }).__notificationAsync;
const mockGenerateEntryTitle = (jest.requireMock('@/services/ai') as { __generateEntryTitle: jest.Mock }).__generateEntryTitle;
const mockRunJournalFinishBackground = (jest.requireMock('@/services/journal/journalFinishSideEffects') as { __runJournalFinishBackground: jest.Mock }).__runJournalFinishBackground;
const mockNotifyUser = (jest.requireMock('@/components/ui/webConfirm') as { __notifyUser: jest.Mock }).__notifyUser;

const messages = [
    { id: 'm1', role: 'user' as const, content: 'Today I felt calm by the window.', timestamp: 1 },
];
const savedEntry = {
    id: 'entry-1',
    title: 'A gentle title',
    emoji: '📝',
    messages,
    status: 'completed' as const,
    createdAt: 1,
    updatedAt: 1,
};

function createDeps(overrides: { messages?: typeof messages; inputValue?: string } = {}) {
    const create = jest.fn().mockResolvedValue(savedEntry);
    const update = jest.fn().mockResolvedValue(savedEntry);
    const finalize = jest.fn();
    const clearPersistedSession = jest.fn().mockResolvedValue(undefined);
    const finalizePersistedSession = jest.fn().mockResolvedValue(undefined);
    const handleNewChat = jest.fn();
    const resetChatState = jest.fn();
    const onCelebrate = jest.fn();
    const options = {
        messages: overrides.messages ?? messages,
        entryId: undefined,
        continuedEntry: null,
        create,
        update,
        finalize,
        clearPersistedSession,
        finalizePersistedSession,
        handleNewChat,
        resetChatState,
        onCelebrate,
        inputValue: overrides.inputValue ?? '',
    };
    return {
        options,
        create,
        update,
        finalize,
        clearPersistedSession,
        finalizePersistedSession,
        handleNewChat,
        resetChatState,
        onCelebrate,
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateEntryTitle.mockReset().mockResolvedValue('A gentle title');
    mockNotificationAsync.mockReset().mockResolvedValue(undefined);
    mockRunJournalFinishBackground.mockReset().mockReturnValue({
        runId: 'run-1',
        promise: Promise.resolve(),
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('useJournalChatFinish — failed saves are visible and retryable', () => {
    it('tells the writer a Close draft save failed and keeps the chat so Close can be tried again', async () => {
        const deps = createDeps();
        deps.create.mockRejectedValueOnce(new Error('storage unavailable'));
        deps.create.mockResolvedValueOnce(savedEntry);
        const { result } = renderHook(() => useJournalChatFinish(deps.options));

        await act(async () => {
            await result.current.handleClose();
        });

        expect(mockNotifyUser).toHaveBeenCalledWith(
            'Could not save your draft',
            'Your chat is still here. Please try again.',
        );
        expect(deps.finalize).not.toHaveBeenCalled();
        expect(deps.clearPersistedSession).not.toHaveBeenCalled();
        expect(deps.resetChatState).not.toHaveBeenCalled();
        expect(mockReplace).not.toHaveBeenCalled();

        // The words are still here: a second Close must save and navigate.
        await act(async () => {
            await result.current.handleClose();
        });
        expect(deps.create).toHaveBeenCalledTimes(2);
        expect(deps.create).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'draft' }));
        expect(deps.finalize).toHaveBeenCalledTimes(1);
        expect(deps.clearPersistedSession).toHaveBeenCalledTimes(1);
        expect(deps.resetChatState).toHaveBeenCalledTimes(1);
        expect(mockReplace).toHaveBeenCalledWith('/(tabs)/entries');
    });

    it('tells the writer a Finish save failed and still saves and navigates on retry', async () => {
        const deps = createDeps();
        deps.create.mockRejectedValueOnce(new Error('storage unavailable'));
        deps.create.mockResolvedValueOnce(savedEntry);
        const { result } = renderHook(() => useJournalChatFinish(deps.options));

        await act(async () => {
            await result.current.handleFinishEntry();
        });

        expect(mockNotifyUser).toHaveBeenCalledWith(
            'Could not save your entry',
            'Your words are still here. Please try again.',
        );
        expect(deps.clearPersistedSession).not.toHaveBeenCalled();
        expect(deps.handleNewChat).not.toHaveBeenCalled();
        expect(deps.onCelebrate).not.toHaveBeenCalled();
        expect(mockRunJournalFinishBackground).not.toHaveBeenCalled();
        expect(mockReplace).not.toHaveBeenCalled();
        expect(result.current.isSaving).toBe(false);

        // A ref-based lock must release after failure, so Finish still works.
        await act(async () => {
            await result.current.handleFinishEntry();
        });
        expect(deps.create).toHaveBeenCalledTimes(2);
        expect(deps.create).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'completed' }));
        // Finish drops the stored chat and moves to a fresh conversation id, so
        // the words already saved can never reappear under Drafts (DEF-030).
        expect(deps.finalizePersistedSession).toHaveBeenCalledTimes(1);
        expect(deps.handleNewChat).toHaveBeenCalledTimes(1);
        expect(deps.onCelebrate).toHaveBeenCalledTimes(1);
        expect(mockNotificationAsync).toHaveBeenCalledTimes(1);
        expect(mockRunJournalFinishBackground).toHaveBeenCalledWith(savedEntry);
        expect(mockReplace).toHaveBeenCalledWith({
            pathname: '/entry-reflection',
            params: { entryId: 'entry-1' },
        });
        expect(result.current.isSaving).toBe(false);
    });

    it('saves the entry only once when Finish is pressed twice before the save settles', async () => {
        const deps = createDeps();
        let release!: (value: typeof savedEntry) => void;
        const pendingSave = new Promise<typeof savedEntry>((resolve) => {
            release = resolve;
        });
        deps.create.mockReturnValue(pendingSave);
        const { result } = renderHook(() => useJournalChatFinish(deps.options));

        let firstPress!: Promise<void>;
        let secondPress!: Promise<void>;
        act(() => {
            firstPress = result.current.handleFinishEntry();
            secondPress = result.current.handleFinishEntry();
        });

        release(savedEntry);
        await act(async () => {
            await Promise.all([firstPress, secondPress]);
        });

        expect(deps.create).toHaveBeenCalledTimes(1);
        expect(mockReplace).toHaveBeenCalledWith({
            pathname: '/entry-reflection',
            params: { entryId: 'entry-1' },
        });
        expect(result.current.isSaving).toBe(false);
    });


describe('useJournalChatFinish — typed words and rapid Close presses', () => {
    it('saves words still in the composer when Close is pressed', async () => {
        const deps = createDeps({
            messages: [],
            inputValue: '  A thought I have not sent yet.  ',
        });
        const { result } = renderHook(() => useJournalChatFinish(deps.options));

        await act(async () => {
            await result.current.handleClose();
        });

        expect(deps.create).toHaveBeenCalledTimes(1);
        expect(deps.create).toHaveBeenCalledWith(expect.objectContaining({
            status: 'draft',
            messages: expect.arrayContaining([
                expect.objectContaining({
                    role: 'user',
                    content: 'A thought I have not sent yet.',
                }),
            ]),
        }));
        expect(deps.clearPersistedSession).toHaveBeenCalledTimes(1);
        expect(mockReplace).toHaveBeenCalledWith('/(tabs)/entries');
    });

    it('saves words still in the composer when Finish is pressed', async () => {
        const deps = createDeps({
            messages: [],
            inputValue: '  A thought I have not sent yet.  ',
        });
        deps.create.mockResolvedValueOnce(savedEntry);
        const { result } = renderHook(() => useJournalChatFinish(deps.options));

        await act(async () => {
            await result.current.handleFinishEntry();
        });

        expect(deps.create).toHaveBeenCalledTimes(1);
        expect(deps.create).toHaveBeenLastCalledWith(expect.objectContaining({
            status: 'completed',
            messages: expect.arrayContaining([
                expect.objectContaining({
                    role: 'user',
                    content: 'A thought I have not sent yet.',
                }),
            ]),
        }));
        expect(mockReplace).toHaveBeenCalledWith({
            pathname: '/entry-reflection',
            params: { entryId: 'entry-1' },
        });
    });

    it('creates one draft when Close is pressed twice before the save settles', async () => {
        const deps = createDeps({ inputValue: 'A thought I have not sent yet.' });
        let release!: (value: typeof savedEntry) => void;
        const pendingSave = new Promise<typeof savedEntry>((resolve) => { release = resolve; });
        deps.create.mockReturnValue(pendingSave);
        const { result } = renderHook(() => useJournalChatFinish(deps.options));

        let firstPress!: Promise<void>;
        let secondPress!: Promise<void>;
        act(() => {
            firstPress = result.current.handleClose();
            secondPress = result.current.handleClose();
        });
        release(savedEntry);
        await act(async () => {
            await Promise.all([firstPress, secondPress]);
        });

        expect(deps.create).toHaveBeenCalledTimes(1);
        expect(deps.clearPersistedSession).toHaveBeenCalledTimes(1);
        expect(deps.resetChatState).toHaveBeenCalledTimes(1);
        expect(mockReplace).toHaveBeenCalledTimes(1);
    });
});
});
