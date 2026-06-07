/* eslint-disable import/first */

const mockStore = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn((key: string) => Promise.resolve(mockStore.get(key) ?? null)),
        setItem: jest.fn((key: string, value: string) => {
            mockStore.set(key, value);
            return Promise.resolve();
        }),
    },
}));

import {
    AI_FEEDBACK_STORAGE_KEY,
    buildFeedbackGuidance,
    listAiFeedback,
    saveAiFeedback,
} from '../../services/feedback/feedbackStorage';

describe('feedbackStorage', () => {
    beforeEach(() => {
        mockStore.clear();
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-06-07T10:00:00Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
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
