/* eslint-disable import/first */
/**
 * Real behavior: a past calendar day reaches create() as the entry's date,
 * and an EDIT of an existing entry never moves its date.
 */
import { act, renderHook } from '@testing-library/react-native';

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock('expo-haptics', () => ({
    notificationAsync: jest.fn(() => Promise.resolve()),
    NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('@/services/ai', () => ({ generateEntryTitle: jest.fn(() => Promise.resolve('A quiet day')) }));
jest.mock('@/services/ai/ai', () => ({}));
jest.mock('@/services/journal/journalFinishSideEffects', () => ({
    runJournalFinishBackground: jest.fn(() => ({ runId: 'run-1', promise: Promise.resolve() })),
}));
jest.mock('@/components/ui/webConfirm', () => ({
    notifyUser: jest.fn(), webConfirm: jest.fn(), webNotify: jest.fn(),
}));
jest.mock('@/services/prompts/writtenPromptStarters', () => ({
    markStarterWritten: jest.fn(() => Promise.resolve()),
}));

import { useJournalChatFinish } from '../../hooks/chat/useJournalChatFinish';
import { backfillCreatedAt } from '../../utils/writingDay';

const messages = [{ role: 'user', content: 'I walked by the river today.' }];
const savedEntry = {
    id: 'entry-1', title: 'A quiet day', emoji: '', messages, status: 'completed',
    createdAt: 1000, updatedAt: 1000,
};
const PAST = new Date(2026, 10, 7, 12, 0, 0, 0).getTime();

function deps(extra: Record<string, unknown> = {}) {
    return {
        messages,
        inputValue: '',
        entryId: undefined,
        continuedEntry: null,
        create: jest.fn().mockResolvedValue(savedEntry),
        update: jest.fn().mockResolvedValue(savedEntry),
        finalize: jest.fn(),
        clearPersistedSession: jest.fn().mockResolvedValue(undefined),
        finalizePersistedSession: jest.fn().mockResolvedValue(undefined),
        handleNewChat: jest.fn(),
        resetChatState: jest.fn(),
        onCelebrate: jest.fn(),
        ...extra,
    };
}

beforeEach(() => { jest.clearAllMocks(); jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { jest.restoreAllMocks(); });

describe('finish on a chosen past day', () => {
    it('passes local noon of that day to create()', async () => {
        const d = deps({ writeOnCreatedAt: PAST });
        const { result } = renderHook(() => useJournalChatFinish(d as never));
        await act(async () => { await result.current.handleFinishEntry(); });
        expect(d.create).toHaveBeenCalledTimes(1);
        expect(d.create).toHaveBeenCalledWith(expect.objectContaining({ createdAt: PAST, status: 'completed' }));
        expect(d.update).not.toHaveBeenCalled();
    });

    it('an ordinary finish leaves the date to the storage layer', async () => {
        const d = deps();
        const { result } = renderHook(() => useJournalChatFinish(d as never));
        await act(async () => { await result.current.handleFinishEntry(); });
        expect(Object.keys(d.create.mock.calls[0][0])).not.toContain('createdAt');
    });

    it('editing an existing entry never moves its date', async () => {
        const d = deps({ writeOnCreatedAt: PAST, entryId: 'entry-1' });
        const { result } = renderHook(() => useJournalChatFinish(d as never));
        await act(async () => { await result.current.handleFinishEntry(); });
        expect(d.update).toHaveBeenCalledTimes(1);
        expect(Object.keys(d.update.mock.calls[0][1])).not.toContain('createdAt');
        expect(d.create).not.toHaveBeenCalled();
    });

    it('the helper refuses today and the future even if a caller passes them', () => {
        expect(backfillCreatedAt('2026-11-09', '2026-11-09', Date.now())).toBeUndefined();
        expect(backfillCreatedAt('2026-11-10', '2026-11-09', Date.now())).toBeUndefined();
    });
});
