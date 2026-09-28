/**
 * The two ways a journal sitting ends.
 *
 * `handleClose` keeps the conversation as a draft; `handleFinishEntry` completes
 * it. Both live here rather than in the screen: `app/` holds routes and screens,
 * not orchestration, and the finish path is the one place where the title call,
 * the save, the celebration and the background memory side effects have to stay
 * in a fixed order.
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { generateEntryTitle } from '@/services/ai';
import type { Message } from '@/services/ai/ai';
import { runJournalFinishBackground } from '@/services/journal/journalFinishSideEffects';
import type {
    JournalEntry,
    JournalEntryCreateInput,
    JournalEntryUpdateInput,
} from '@/services/journal/journalStorage.types';
import { generateTitle, hasContent, inferMoodEmoji } from '@/hooks/useEntryUtils';
import { withTimeout } from '@/utils/async';

/**
 * The title call is the only AI step the writer waits on before the entry is
 * saved. A stalled provider must fall back to the local title instead of
 * holding Finish open.
 */
const FINISH_TITLE_TIMEOUT_MS = 8_000;

interface UseJournalChatFinishOptions {
    messages: Message[];
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

    const handleClose = useCallback(async () => {
        finalize();
        // Save as draft if there's content
        if (hasContent(messages)) {
            try {
                const title = generateTitle(messages);
                const emoji = inferMoodEmoji(messages);

                if (entryId) {
                    await update(entryId, {
                        title,
                        emoji,
                        messages,
                        status: continuedEntry?.status ?? 'draft',
                    });
                } else {
                    await create({
                        title,
                        emoji,
                        messages,
                        status: 'draft',
                    });
                }
            } catch (error) {
                console.error('Failed to save draft:', error);
            }
        }

        // The conversation now lives as an explicit draft — drop the autosave session.
        await clearPersistedSession();

        resetChatState();
        router.replace('/(tabs)/entries');
    }, [
        messages, resetChatState, router, create, update, entryId, continuedEntry,
        clearPersistedSession, finalize,
    ]);

    const handleFinishEntry = useCallback(async () => {
        if (!hasContent(messages) || isSaving) return;

        finalize();
        setIsSaving(true);
        setFinishStage('Preparing your entry');
        try {
            const entryText = messages
                .filter(m => m.role === 'user')
                .map(m => m.content)
                .join('\n\n');
            let title = generateTitle(messages); // Fallback
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

            const emoji = inferMoodEmoji(messages);

            let savedEntry: JournalEntry | null = null;
            setFinishStage('Saving your entry');

            if (entryId) {
                savedEntry = await update(entryId, {
                    title,
                    emoji,
                    messages,
                    status: 'completed',
                });
            } else {
                savedEntry = await create({
                    title,
                    emoji,
                    messages,
                    status: 'completed',
                });
            }
            const savedEntryId = savedEntry?.id ?? entryId;
            // Completed work must not linger as an active session.
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
        } finally {
            setIsSaving(false);
            setFinishStage('Preparing your entry');
        }
    }, [
        messages, isSaving, router, create, update, entryId, handleNewChat,
        clearPersistedSession, finalize, onCelebrate,
    ]);

    return { handleClose, handleFinishEntry, isSaving, finishStage };
}
