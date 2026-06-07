import { useState } from 'react';
import { resolveIntentionChatContent } from '@/constants/intentionChat';
import type { Message } from '@/services/ai/ai';
import type {
    AiFeedbackRecord,
    AiFeedbackValue,
    SaveAiFeedbackInput,
} from '@/services/feedback/feedbackStorage';

interface UseIntentionFeedbackModalOptions {
    conversationId: string;
    feedbackByMessageId: Record<string, AiFeedbackRecord>;
    messages: readonly Message[];
    personaId?: string;
    saveFeedback: (input: Omit<SaveAiFeedbackInput, 'scope'>) => Promise<AiFeedbackRecord>;
}

interface PendingFeedback {
    messageId: string;
    value: AiFeedbackValue;
    comment: string;
}

export function useIntentionFeedbackModal({
    conversationId,
    feedbackByMessageId,
    messages,
    personaId,
    saveFeedback,
}: UseIntentionFeedbackModalOptions) {
    const [pendingFeedback, setPendingFeedback] = useState<PendingFeedback | null>(null);

    const handleThumb = (id: string, value: AiFeedbackValue) => {
        setPendingFeedback({
            messageId: id,
            value,
            comment: feedbackByMessageId[id]?.comment ?? '',
        });
    };

    const handleSaveFeedback = async () => {
        if (!pendingFeedback) return;
        const message = messages.find((item) => item.id === pendingFeedback.messageId);
        if (!message) {
            setPendingFeedback(null);
            return;
        }

        await saveFeedback({
            messageId: message.id,
            conversationId,
            personaId,
            value: pendingFeedback.value,
            comment: pendingFeedback.comment,
            messageContent: resolveIntentionChatContent(message.content),
        });
        setPendingFeedback(null);
    };

    return {
        handleThumb,
        feedbackModalProps: {
            visible: pendingFeedback !== null,
            value: pendingFeedback?.value ?? 'up',
            comment: pendingFeedback?.comment ?? '',
            onCommentChange: (comment: string) => setPendingFeedback((current) => (
                current ? { ...current, comment } : current
            )),
            onClose: () => setPendingFeedback(null),
            onSubmit: handleSaveFeedback,
        },
    };
}
