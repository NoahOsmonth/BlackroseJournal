import {
    buildIntentionChatSummary,
    finishIntentionChat,
    saveIntentionChatDraft,
    withPendingInput,
} from '../../../services/intentions/intentionChatCompletion';
import {
    createCheckIn,
    createIntention,
    updateCheckIn,
    updateIntention,
} from '../../../services/intentions/intentionsStorage';
import type { Message } from '../../../services/ai/chatTypes';

jest.mock('../../../services/intentions/intentionsStorage', () => ({
    createCheckIn: jest.fn(),
    createIntention: jest.fn(),
    updateCheckIn: jest.fn(),
    updateIntention: jest.fn(),
}));

const userMessage: Message = {
    id: 'm1',
    role: 'user',
    content: 'I want to walk daily after breakfast.',
    timestamp: 1,
};

describe('intentionChatCompletion', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(Date, 'now').mockReturnValue(123);
        (createCheckIn as jest.Mock).mockResolvedValue({ id: 'draft_1' });
        (createIntention as jest.Mock).mockResolvedValue({
            id: 'intent_1',
            title: 'Walk daily',
            description: 'Walk daily',
            area: 'wellbeing',
        });
        (updateIntention as jest.Mock).mockResolvedValue({
            id: 'intent_1',
            title: 'Walk daily',
            description: userMessage.content,
            area: 'wellbeing',
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('summarizes the first user message and truncates long text', () => {
        const long = `${'x'.repeat(180)} trailing`;

        expect(buildIntentionChatSummary([userMessage])).toBe(userMessage.content);
        expect(buildIntentionChatSummary([{ ...userMessage, content: long }])).toHaveLength(163);
    });

    it('appends pending input as a user message', () => {
        const result = withPendingInput([], '  one next step  ');

        expect(result).toEqual([
            {
                id: '123',
                role: 'user',
                content: 'one next step',
                timestamp: 123,
            },
        ]);
    });

    it('creates a new explicit draft from an in-flight chat', async () => {
        const id = await saveIntentionChatDraft({
            messages: [userMessage],
            inputValue: '',
            draftCheckInId: null,
            checkInType: 'intention',
            personaId: 'p1',
        });

        expect(id).toBe('draft_1');
        expect(createCheckIn).toHaveBeenCalledWith(expect.objectContaining({
            title: userMessage.content,
            status: 'draft',
            personaId: 'p1',
        }));
    });

    it('updates an existing draft instead of creating another one', async () => {
        await saveIntentionChatDraft({
            messages: [userMessage],
            inputValue: '',
            draftCheckInId: 'draft_existing',
            checkInType: 'morning',
        });

        expect(updateCheckIn).toHaveBeenCalledWith('draft_existing', expect.objectContaining({
            status: 'draft',
            summary: userMessage.content,
        }));
        expect(createCheckIn).not.toHaveBeenCalled();
    });

    it('refine finish updates the existing intention description', async () => {
        const result = await finishIntentionChat({
            messages: [userMessage],
            inputValue: '',
            draftCheckInId: null,
            intentionId: 'intent_1',
            checkInType: 'intention',
            intention: null,
            isRefineMode: true,
        });

        expect(updateIntention).toHaveBeenCalledWith('intent_1', {
            description: userMessage.content,
        });
        expect(createCheckIn).not.toHaveBeenCalled();
        expect(result.resolvedIntention?.id).toBe('intent_1');
    });
});
