/* eslint-disable import/first */

const mockStore = new Map<string, string>();
type Deferred = { promise: Promise<void>; resolve: () => void };
let mockDelayedReadKey: string | null = null;
let mockDelayedRead: Deferred | null = null;
let mockDelayedReadStarted: (() => void) | null = null;
let mockFirstFeedbackWrite: Deferred | null = null;
let mockFirstFeedbackWriteStarted: (() => void) | null = null;
let mockFeedbackWriteCount = 0;
let mockSecondFeedbackRead: Deferred | null = null;

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(async (key: string) => {
            if (key === mockDelayedReadKey && mockDelayedRead) {
                mockDelayedReadStarted?.();
                await mockDelayedRead.promise;
            }
            if (key === '@ai_response_feedback' && mockSecondFeedbackRead) {
                mockSecondFeedbackRead.resolve();
                mockSecondFeedbackRead = null;
            }
            return mockStore.get(key) ?? null;
        }),
        setItem: jest.fn(async (key: string, value: string) => {
            if (key === '@ai_response_feedback' && mockFirstFeedbackWrite && mockFeedbackWriteCount === 0) {
                mockFeedbackWriteCount += 1;
                mockFirstFeedbackWriteStarted?.();
                await mockFirstFeedbackWrite.promise;
            }
            mockStore.set(key, value);
        }),
    },
}));

import {
    AI_FEEDBACK_STORAGE_KEY,
    buildFeedbackGuidance,
    listAiFeedback,
    saveAiFeedback,
} from '../../services/feedback/feedbackStorage';
import { activateAccount, clearActiveAccount } from '../../services/account/accountRuntime';
import { getAccountScopedStorageKeyForAccount } from '../../services/account/accountScopedStorage';

function deferred(): Deferred {
    let resolve!: () => void;
    const promise = new Promise<void>((nextResolve) => { resolve = nextResolve; });
    return { promise, resolve };
}

describe('feedbackStorage', () => {
    beforeEach(async () => {
        await clearActiveAccount();
        mockStore.clear();
        mockDelayedReadKey = null;
        mockDelayedRead = null;
        mockDelayedReadStarted = null;
        mockFirstFeedbackWrite = null;
        mockFirstFeedbackWriteStarted = null;
        mockFeedbackWriteCount = 0;
        mockSecondFeedbackRead = null;
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-06-07T10:00:00Z'));
    });

    afterEach(async () => {
        jest.useRealTimers();
        await clearActiveAccount();
    });

    it('saves thumbs feedback with comments into local feedback memory', async () => {
        const record = await saveAiFeedback({
            scope: 'intention',
            messageId: 'assistant-1',
            conversationId: 'conversation-1',
            personaId: 'rosebud',
            value: 'up',
            comment: 'This was gentle and direct.',
            messageContent: 'Try naming the feeling first.',
        });

        const saved = JSON.parse(mockStore.get(AI_FEEDBACK_STORAGE_KEY) ?? '{}');
        expect(saved[record.id].comment).toBe('This was gentle and direct.');
        await expect(listAiFeedback('intention')).resolves.toEqual([record]);
    });

    it('treats malformed persisted feedback as an empty store', async () => {
        mockStore.set(AI_FEEDBACK_STORAGE_KEY, '{not valid json');

        await expect(listAiFeedback()).resolves.toEqual([]);
    });

    it('serializes concurrent saves so neither feedback record is lost', async () => {
        const releaseFirstWrite = deferred();
        const firstWriteStarted = deferred();
        const secondRead = deferred();
        mockFirstFeedbackWrite = releaseFirstWrite;
        mockFirstFeedbackWriteStarted = firstWriteStarted.resolve;
        mockSecondFeedbackRead = secondRead;

        const first = saveAiFeedback({
            scope: 'journal',
            messageId: 'first',
            value: 'up',
            messageContent: 'First response.',
        });
        await firstWriteStarted.promise;

        const second = saveAiFeedback({
            scope: 'journal',
            messageId: 'second',
            value: 'down',
            messageContent: 'Second response.',
        });
        await secondRead.promise;
        releaseFirstWrite.resolve();

        await Promise.all([first, second]);
        await expect(listAiFeedback()).resolves.toHaveLength(2);
    });

    it('aborts a feedback read whose account becomes stale', async () => {
        const accountAKey = getAccountScopedStorageKeyForAccount(
            AI_FEEDBACK_STORAGE_KEY,
            'feedback-account-a',
        );
        mockStore.set(accountAKey, JSON.stringify({
            'journal:global:stale': {
                id: 'journal:global:stale',
                scope: 'journal',
                messageId: 'stale',
                value: 'up',
                messageContent: 'A private response.',
                createdAt: 1,
                updatedAt: 1,
            },
        }));
        const releaseRead = deferred();
        const readStarted = deferred();
        mockDelayedReadKey = accountAKey;
        mockDelayedRead = releaseRead;
        mockDelayedReadStarted = readStarted.resolve;

        await activateAccount('feedback-account-a');
        const pending = listAiFeedback();
        await readStarted.promise;
        const switching = activateAccount('feedback-account-b');
        releaseRead.resolve();

        await expect(pending).rejects.toThrow('Account operation was aborted');
        await switching;
        await expect(listAiFeedback()).resolves.toEqual([]);
    });

    it('builds prompt guidance that changes future tone and style', async () => {
        const liked = await saveAiFeedback({
            scope: 'intention',
            messageId: 'liked',
            value: 'up',
            comment: 'Shorter and warmer.',
            messageContent: 'A concise response.',
        });
        const disliked = await saveAiFeedback({
            scope: 'intention',
            messageId: 'disliked',
            value: 'down',
            comment: 'Too clinical.',
            messageContent: 'A detached response.',
        });

        const guidance = buildFeedbackGuidance([disliked, liked]);

        expect(guidance).toContain('Response Feedback Memory');
        expect(guidance).toContain('Do more of this tone/style');
        expect(guidance).toContain('Shorter and warmer.');
        expect(guidance).toContain('Avoid this tone/style');
        expect(guidance).toContain('Too clinical.');
    });
});
