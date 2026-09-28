/**
 * The two ways a check-in sitting ends: keep it as a draft (close) or complete
 * it (Finish entry). Extracted from the screen so `app/intentions/chat.tsx`
 * stays a route — the ordering here matters (finalize → title → finish →
 * goal stamp → drop the session) and belongs with the other check-in hooks.
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';

import { hasContent } from '@/hooks/journal/useEntryUtils';
import { generateEntryTitle } from '@/services/ai';
import type { Message } from '@/services/ai/ai';
import { markIntentionGoalComplete } from '@/services/goals/goalsStorage';
import {
    finishIntentionChat,
    saveIntentionChatDraft,
    shouldMarkIntentionGoalComplete,
} from '@/services/intentions/intentionChatCompletion';
import type {
    Intention,
    IntentionCheckInType,
} from '@/services/intentions/intentionsStorage.types';
import { getLocalDateKey } from '@/utils/date';

interface UseIntentionChatFinishOptions {
    messages: Message[];
    inputValue: string;
    conversationId: string;
    checkInType: IntentionCheckInType;
    draftCheckInId: string | null;
    intentionId?: string;
    intention: Intention | null;
    areaParam?: string;
    personaId?: string;
    isRefineMode: boolean;
    /** Flush the live conversation to the session store before the save. */
    finalize: () => void;
    clearPersistedSession: () => Promise<void>;
    removeSession: (conversationId: string) => Promise<void>;
    handleNewChat: () => void;
    onDraftSaved: (draftId: string) => void;
}

export function useIntentionChatFinish({
    messages,
    inputValue,
    conversationId,
    checkInType,
    draftCheckInId,
    intentionId,
    intention,
    areaParam,
    personaId,
    isRefineMode,
    finalize,
    clearPersistedSession,
    removeSession,
    handleNewChat,
    onDraftSaved,
}: UseIntentionChatFinishOptions) {
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);
    const [finishStage, setFinishStage] = useState('Preparing your check-in');

    const handleClose = useCallback(async () => {
        finalize();
        const hasDraftContent = hasContent(messages) || inputValue.trim().length > 0;
        if (hasDraftContent) {
            const draftId = await saveIntentionChatDraft({
                messages,
                inputValue,
                draftCheckInId,
                intentionId,
                checkInType,
                personaId,
            });
            if (draftId) onDraftSaved(draftId);
        }

        // Saved as an explicit check-in draft — drop the autosave session.
        await clearPersistedSession();

        handleNewChat();
        router.replace('/(tabs)/today');
    }, [
        checkInType,
        clearPersistedSession,
        draftCheckInId,
        finalize,
        handleNewChat,
        inputValue,
        intentionId,
        messages,
        onDraftSaved,
        personaId,
        router,
    ]);

    const handleFinish = useCallback(async () => {
        if ((!hasContent(messages) && !inputValue.trim()) || isSaving) {
            return;
        }

        finalize();
        setIsSaving(true);
        setFinishStage('Preparing your check-in');
        try {
            const entryText = [...messages]
                .filter((message) => message.role === 'user')
                .map((message) => message.content)
                .join('\n\n');

            let generatedTitle: string | undefined;
            if (entryText.trim()) {
                try {
                    setFinishStage('Finding a title');
                    generatedTitle = await generateEntryTitle({ entryText });
                } catch (error) {
                    console.warn('AI title generation failed, using summary fallback', error);
                }
            }

            setFinishStage('Saving your check-in');
            const { resolvedIntention, checkIn } = await finishIntentionChat({
                messages,
                inputValue,
                draftCheckInId,
                intentionId,
                checkInType,
                personaId,
                intention,
                areaParam,
                isRefineMode,
                title: generatedTitle,
            });

            // Only stamp a completed goal when this finish produced a completed
            // check-in; refine mode creates none and must not duplicate a goal.
            if (resolvedIntention && shouldMarkIntentionGoalComplete(checkIn, checkInType)) {
                await markIntentionGoalComplete(
                    resolvedIntention.title,
                    getLocalDateKey(new Date()),
                    resolvedIntention.id
                );
            }

            // Completed check-in must not linger as an active session.
            await removeSession(conversationId);

            handleNewChat();
            if (resolvedIntention) {
                router.replace({ pathname: '/intentions/detail', params: { id: resolvedIntention.id } });
            } else {
                router.replace('/(tabs)/today');
            }
        } finally {
            setIsSaving(false);
            setFinishStage('Preparing your check-in');
        }
    }, [
        areaParam,
        checkInType,
        conversationId,
        draftCheckInId,
        finalize,
        handleNewChat,
        inputValue,
        intention,
        intentionId,
        isRefineMode,
        isSaving,
        messages,
        personaId,
        removeSession,
        router,
    ]);

    return { handleClose, handleFinish, isSaving, finishStage };
}
