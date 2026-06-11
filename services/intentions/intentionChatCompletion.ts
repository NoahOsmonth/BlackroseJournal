import {
    createCheckIn,
    createIntention,
    updateCheckIn,
    updateIntention,
} from './intentionsStorage';
import type {
    Intention,
    IntentionArea,
    IntentionCheckInType,
} from './intentionsStorage.types';
import type { Message } from '@/services/ai/chatTypes';

export function buildIntentionChatSummary(messages: Pick<Message, 'role' | 'content'>[]): string {
    const first = messages.find((message) => message.role === 'user');
    if (!first) return 'No summary yet.';
    const text = first.content.trim();
    return text.length > 160 ? `${text.slice(0, 160).trim()}...` : text;
}

export function withPendingInput(messages: Message[], inputValue: string): Message[] {
    const trimmed = inputValue.trim();
    if (!trimmed) return [...messages];
    return [
        ...messages,
        {
            id: Date.now().toString(),
            role: 'user',
            content: trimmed,
            timestamp: Date.now(),
        },
    ];
}

interface SaveDraftOptions {
    messages: Message[];
    inputValue: string;
    draftCheckInId: string | null;
    intentionId?: string;
    checkInType: IntentionCheckInType;
    personaId?: string;
}

export async function saveIntentionChatDraft({
    messages,
    inputValue,
    draftCheckInId,
    intentionId,
    checkInType,
    personaId,
}: SaveDraftOptions): Promise<string | null> {
    const draftMessages = withPendingInput(messages, inputValue);
    const summary = buildIntentionChatSummary(draftMessages);

    if (draftCheckInId) {
        await updateCheckIn(draftCheckInId, {
            messages: draftMessages,
            status: 'draft',
            summary,
            title: summary,
        });
        return draftCheckInId;
    }

    const draft = await createCheckIn({
        intentionId,
        type: checkInType,
        title: summary,
        summary,
        mood: 'Reflective',
        personaId,
        messages: draftMessages,
        status: 'draft',
    });
    return draft.id;
}

interface FinishChatOptions extends SaveDraftOptions {
    intention: Intention | null;
    areaParam?: string;
    isRefineMode: boolean;
    title?: string;
}

interface FinishChatResult {
    resolvedIntention: Intention | null;
    finalMessages: Message[];
    summary: string;
}

export async function finishIntentionChat({
    messages,
    inputValue,
    draftCheckInId,
    intentionId,
    checkInType,
    personaId,
    intention,
    areaParam,
    isRefineMode,
    title,
}: FinishChatOptions): Promise<FinishChatResult> {
    const finalMessages = withPendingInput(messages, inputValue);
    const summary = buildIntentionChatSummary(finalMessages);
    const checkInTitle = title?.trim() ? title.trim() : summary;
    let resolvedIntention = intention;

    if (!intentionId && checkInType === 'intention') {
        resolvedIntention = await createIntention({
            title: checkInTitle,
            description: summary,
            area: (areaParam ?? 'wellbeing') as IntentionArea,
        });
    }

    if (isRefineMode && intentionId) {
        resolvedIntention = await updateIntention(intentionId, { description: summary });
    } else if (draftCheckInId) {
        await updateCheckIn(draftCheckInId, {
            messages: finalMessages,
            status: 'completed',
            summary,
            title: checkInTitle,
            personaId,
        });
    } else {
        await createCheckIn({
            intentionId: resolvedIntention?.id,
            type: checkInType,
            title: checkInTitle,
            summary,
            mood: 'Reflective',
            personaId,
            messages: finalMessages,
            status: 'completed',
        });
    }

    return { resolvedIntention, finalMessages, summary };
}
