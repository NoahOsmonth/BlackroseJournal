/**
 * The two ways a journal sitting ends.
 *
 * `handleClose` keeps the conversation as a draft; `handleFinishEntry` completes
 * it. Both live here rather than in the screen: `app/` holds routes and screens,
 * not orchestration, and the finish path is the one place where the title call,
 * the save, the celebration and the background memory side effects have to stay
 * in a fixed order.
 */

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { notifyUser } from '@/components/ui/webConfirm';
import { generateTitle, hasContent, inferMoodEmoji } from '@/hooks/useEntryUtils';
import { generateEntryTitle } from '@/services/ai';
import type { Message } from '@/services/ai/ai';
import { runJournalFinishBackground } from '@/services/journal/journalFinishSideEffects';
import { withPendingInput } from '@/services/journal/journalPendingInput';
import type {
    JournalEntry,
    JournalEntryCreateInput,
    JournalEntryUpdateInput,
} from '@/services/journal/journalStorage.types';
import { withTimeout } from '@/utils/async';

/**
 * The title call is the only AI step the writer waits on before the entry is
 * saved. A stalled provider must fall back to the local title instead of
 * holding Finish open.
 */
const FINISH_TITLE_TIMEOUT_MS = 8_000;

interface UseJournalChatFinishOptions {
    messages: Message[];
    /** Words still in the writing slip, not yet sent as a message. */
    inputValue: string;
    entryId?: string;
    continuedEntry: JournalEntry | null;
    create: (input: JournalEntryCreateInput) => Promise<JournalEntry>;
    update: (id: string, input: JournalEntryUpdateInput) => Promise<JournalEntry | null>;
    /** Flush the live conversation to the session store before the save. */
    finalize: () => void;
    clearPersistedSession: () => Promise<void>;
    handleNewChat: () => void;
    /** Clears the composer + the capsule query text (the draft-close path). */
    resetChatState: () => void;
    /** Plays the finish celebration. */
    onCelebrate: () => void;
}

export function useJournalChatFinish({
    messages,
    inputValue,
    entryId,
    continuedEntry,
    create,
    update,
    finalize,
    clearPersistedSession,
    handleNewChat,
    resetChatState,
    onCelebrate,
}: UseJournalChatFinishOptions) {
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);
    const [finishStage, setFinishStage] = useState('Preparing your entry');
    const finishInFlightRef = useRef(false);
    const closeInFlightRef = useRef(false);
    const closeCompletedRef = useRef(false);

    const finalMessages = useCallback(
        () => withPendingInput(messages, inputValue),
        [messages, inputValue],
    );

    const handleClose = useCallback(async () => {
        if (closeInFlightRef.current || closeCompletedRef.current) return;
        closeInFlightRef.current = true;
        try {
            const messagesToSave = finalMessages();
            if (hasContent(messagesToSave)) {
                const title = generateTitle(messagesToSave);
                const emoji = inferMoodEmoji(messagesToSave);

                if (entryId) {
                    await update(entryId, {
                        title,
                        emoji,
                        messages: messagesToSave,
                        status: continuedEntry?.status ?? 'draft',
                    });
                } else {
                    await create({
                        title,
                        emoji,
                        messages: messagesToSave,
                        status: 'draft',
                    });
                }
            }

            // The explicit save succeeded. Only now suppress the late autosave
            // flush; on a failed save the words must stay recoverable.
            closeCompletedRef.current = true;
            finalize();
            try {
                await clearPersistedSession();
            } catch (error) {
                console.warn('Could not clear the saved chat:', error);
            }
            resetChatState();
            router.replace('/(tabs)/entries');
        } catch (error) {
            console.error('Failed to save draft:', error);
            notifyUser('Could not save your draft', 'Your chat is still here. Please try again.');
        } finally {
            closeInFlightRef.current = false;
        }
    }, [
        finalMessages, resetChatState, router, create, update, entryId, continuedEntry,
        clearPersistedSession, finalize,
    ]);

    const handleFinishEntry = useCallback(async () => {
        const messagesToSave = finalMessages();
        if (!hasContent(messagesToSave) || isSaving || finishInFlightRef.current) return;
        finishInFlightRef.current = true;

        setIsSaving(true);
        setFinishStage('Preparing your entry');
        try {
            const entryText = messagesToSave
                .filter(m => m.role === 'user')
                .map(m => m.content)
                .join('\n\n');
            let title = generateTitle(messagesToSave); // Fallback
            try {
                if (entryText.trim()) {
                    setFinishStage('Finding a title');
                    title = await withTimeout(
                        generateEntryTitle({ entryText }),
                        FINISH_TITLE_TIMEOUT_MS,
                        'Entry title',
                    );
                }
            } catch (err) {
                console.warn('AI title generation failed, using fallback', err);
            }

            const emoji = inferMoodEmoji(messagesToSave);

            let savedEntry: JournalEntry | null = null;
            setFinishStage('Saving your entry');

            if (entryId) {
                savedEntry = await update(entryId, {
                    title,
                    emoji,
                    messages: messagesToSave,
                    status: 'completed',
                });
            } else {
                savedEntry = await create({
                    title,
                    emoji,
                    messages: messagesToSave,
                    status: 'completed',
                });
            }
            const savedEntryId = savedEntry?.id ?? entryId;
            // A completed entry must not linger as an active session.
            finalize();
            await clearPersistedSession();
            handleNewChat();
            if (savedEntryId) {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
                onCelebrate();
                // Analysis + memory side effects run in the background; the
                // reflection screen shows a status banner until they settle.
                if (savedEntry) {
                    void runJournalFinishBackground(savedEntry);
                }
                router.replace({ pathname: '/entry-reflection', params: { entryId: savedEntryId } });
            } else {
                router.replace('/(tabs)/entries');
            }
        } catch (error) {
            console.error('Failed to save entry:', error);
            notifyUser('Could not save your entry', 'Your words are still here. Please try again.');
        } finally {
            finishInFlightRef.current = false;
            setIsSaving(false);
            setFinishStage('Preparing your entry');
        }
    }, [
        finalMessages, isSaving, router, create, update, entryId, handleNewChat,
        clearPersistedSession, finalize, onCelebrate,
    ]);

    return { handleClose, handleFinishEntry, isSaving, finishStage };
}
