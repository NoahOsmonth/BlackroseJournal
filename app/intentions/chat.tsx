import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ScrollView,
    View,
    Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import * as Clipboard from 'expo-clipboard';

import { useChatOrchestration, useChatSessionFlush, useResumeChatSession, flowForCheckInType } from '@/features/chat';
import {
    removeSession,
    type ChatSessionMode,
} from '@/services/ai/sessionStorage';
import { InlineTypingInputRef } from '@/components/InlineTypingInput';
import { usePersonas } from '@/hooks/personas/usePersonas';
import { useIntentionCheckIns } from '@/hooks/intentions/useIntentionCheckIns';
import {
    getCheckIn,
    getIntention,
} from '@/services/intentions/intentionsStorage';
import { Intention, IntentionArea, IntentionCheckInType } from '@/services/intentions/intentionsStorage.types';
import { getIntentionAreaConfig } from '@/constants/intentions';
import { hasContent } from '@/hooks/journal/useEntryUtils';
import { markIntentionGoalComplete } from '@/services/goals/goalsStorage';
import {
    finishIntentionChat,
    saveIntentionChatDraft,
    withPendingInput,
} from '@/services/intentions/intentionChatCompletion';
import { generateEntryTitle } from '@/services/ai';
import { getLocalDateKey } from '@/utils/date';
import { IntentionChatHeader } from '@/components/intentions/IntentionChatHeader';
import { IntentionChatFooter } from '@/components/intentions/IntentionChatFooter';
import { IntentionChatBody } from '@/components/intentions/IntentionChatBody';
import { IntentionChatOverlays } from '@/components/intentions/IntentionChatOverlays';
import { useAiFeedback } from '@/hooks/feedback/useAiFeedback';
import { useGoalsContext } from '@/hooks/goals/useGoalsContext';
import { useIntentionFeedbackModal } from '@/hooks/feedback/useIntentionFeedbackModal';
import type { AiFeedbackValue } from '@/services/feedback/feedbackStorage';
import { usePersonaSettingsActions } from '@/hooks/personas/usePersonaSettingsActions';

export default function IntentionChatScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const scrollViewRef = useRef<ScrollView>(null);
    const inputRef = useRef<InlineTypingInputRef>(null);

    const {
        personas,
        activePersona,
        setActive,
        remove,
        isLoading: isPersonasLoading,
    } = usePersonas();
    const { completed: checkIns } = useIntentionCheckIns();

    const [intention, setIntention] = useState<Intention | null>(null);
    const [inputValue, setInputValue] = useState('');
    const [draftCheckInId, setDraftCheckInId] = useState<string | null>(null);
    const [draftUpdatedAt, setDraftUpdatedAt] = useState<number | null>(null);
    const [personaSheetOpen, setPersonaSheetOpen] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const areaParam = Array.isArray(params.area) ? params.area[0] : params.area;
    const intentionId = Array.isArray(params.intentionId) ? params.intentionId[0] : params.intentionId;
    const typeParam = Array.isArray(params.type) ? params.type[0] : params.type;
    const modeParam = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    const draftIdParam = Array.isArray(params.draftId) ? params.draftId[0] : params.draftId;
    const resumeId = Array.isArray(params.resume) ? params.resume[0] : params.resume;

    const checkInType = (typeParam as IntentionCheckInType) ?? 'intention';
    const trimmedInput = inputValue.trim();
    const flowLabel = checkInType === 'morning'
        ? 'Morning Intention'
        : checkInType === 'evening' ? 'Evening Reflection' : 'Intention Setting';
    const areaConfig = areaParam ? getIntentionAreaConfig(areaParam as IntentionArea) : undefined;

    useEffect(() => {
        let isActive = true;
        const load = async () => {
            if (!intentionId) return;
            const loaded = await getIntention(intentionId);
            if (!isActive) return;
            setIntention(loaded);
        };
        load();
        return () => {
            isActive = false;
        };
    }, [intentionId]);

    const memorySummary = useMemo(() => {
        if (!intentionId) return undefined;
        const latest = checkIns.find((item) => item.intentionId === intentionId);
        return latest?.summary;
    }, [checkIns, intentionId]);

    const conversationId = useMemo(() => {
        if (resumeId) return resumeId;
        if (draftCheckInId) return draftCheckInId;
        if (intentionId) return `intention_${intentionId}_${Date.now()}`;
        return `intention_${Date.now()}`;
    }, [resumeId, draftCheckInId, intentionId]);

    const {
        feedbackByMessageId,
        guidance: feedbackGuidance,
        isLoading: isFeedbackLoading,
        save: saveFeedback,
    } = useAiFeedback({
        scope: 'intention',
        personaId: activePersona?.id,
        conversationId,
    });

    const { goalsContext } = useGoalsContext({ intentionId });

    const feedback = useMemo<Record<string, AiFeedbackValue>>(() => Object.fromEntries(
        Object.entries(feedbackByMessageId).map(([id, record]) => [id, record.value])
    ) as Record<string, AiFeedbackValue>, [feedbackByMessageId]);

    const isRefineMode = modeParam === 'refine';
    const flow = useMemo(
        () => (isRefineMode ? flowForCheckInType('intentionRefine') : flowForCheckInType(checkInType)),
        [checkInType, isRefineMode]
    );
    const flowContext = useMemo(
        () => ({
            activePersona,
            areaLabel: areaConfig?.label,
            intentionTitle: intention?.title,
            memorySummary,
            goalsContext,
            feedbackGuidance,
        }),
        [activePersona, areaConfig?.label, intention?.title, memorySummary, goalsContext, feedbackGuidance]
    );

    const initialPrompt = useMemo(() => {
        if (resumeId || draftIdParam || draftCheckInId || isFeedbackLoading || isPersonasLoading) {
            return undefined;
        }
        return {
            systemPrompt: flow.buildSystemPrompt(flowContext),
            triggerText: '[Start intention check-in]',
        };
    }, [resumeId, draftCheckInId, draftIdParam, isFeedbackLoading, isPersonasLoading, flow, flowContext]);

    const checkInMode: ChatSessionMode = checkInType === 'morning'
        ? 'morning'
        : checkInType === 'evening' ? 'evening' : 'intention';

    const persistRouteParams = useMemo(() => {
        const routeParams: Record<string, string> = {};
        if (intentionId) routeParams.intentionId = intentionId;
        if (areaParam) routeParams.area = areaParam;
        if (typeParam) routeParams.type = typeParam;
        if (modeParam) routeParams.mode = modeParam;
        return Object.keys(routeParams).length > 0 ? routeParams : undefined;
    }, [areaParam, intentionId, modeParam, typeParam]);

    const persist = useMemo(
        () => ({
            conversationId,
            mode: checkInMode,
            personaId: activePersona?.id,
            routeParams: persistRouteParams,
        }),
        [conversationId, checkInMode, activePersona?.id, persistRouteParams]
    );

    const {
        messages,
        streamingMessage,
        isLoading,
        handleSendMessage,
        clearError,
        handleNewChat,
        initializeMessages,
        clearPersistedSession,
        scrollToBottom,
        handleScroll,
    } = useChatOrchestration({
        scrollViewRef,
        inputRef,
        mode: 'intention',
        conversationId,
        flow,
        flowContext,
        initialPrompt,
        persist,
    });

    const { handleThumb, feedbackModalProps } = useIntentionFeedbackModal({
        conversationId,
        feedbackByMessageId,
        messages,
        saveFeedback,
        personaId: activePersona?.id,
    });

    const personaSettings = usePersonaSettingsActions({
        activePersona,
        closePersonaSheet: () => setPersonaSheetOpen(false),
        remove,
    });

    useEffect(() => {
        let isActive = true;
        const loadDraft = async () => {
            if (!draftIdParam) return;
            const draft = await getCheckIn(draftIdParam);
            if (!isActive || !draft) return;
            setDraftCheckInId(draft.id);
            setDraftUpdatedAt(draft.updatedAt);
            if (draft.personaId) {
                await setActive(draft.personaId);
            }
            if (draft.messages && draft.messages.length > 0) {
                initializeMessages(draft.messages);
            }
        };
        loadDraft();
        return () => {
            isActive = false;
        };
    }, [draftIdParam, initializeMessages, setActive]);

    // Resume an autosaved check-in session (conversationId already matches via the resume param).
    useResumeChatSession({
        resumeId,
        initializeMessages,
        onPersona: setActive,
    });

    // Flush the live conversation to the session store on blur/unmount so a
    // back-gesture (previously only the explicit close button) is recoverable.
    const { finalize } = useChatSessionFlush({
        conversationId,
        mode: checkInMode,
        messages,
        personaId: activePersona?.id,
        routeParams: persistRouteParams,
    });

    useEffect(() => {
        scrollToBottom();
    }, [messages, streamingMessage, scrollToBottom]);

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
                personaId: activePersona?.id,
            });
            if (draftId) setDraftCheckInId(draftId);
        }

        // Saved as an explicit check-in draft — drop the autosave session.
        await clearPersistedSession();

        handleNewChat();
        router.replace('/(tabs)/today');
    }, [
        activePersona?.id,
        checkInType,
        clearPersistedSession,
        draftCheckInId,
        finalize,
        handleNewChat,
        inputValue,
        intentionId,
        messages,
        router,
    ]);

    const handleFinish = useCallback(async () => {
        if ((!hasContent(messages) && !inputValue.trim()) || isSaving) {
            return;
        }

        finalize();
        setIsSaving(true);
        try {
            const finalMessages = withPendingInput(messages, inputValue);
            const entryText = finalMessages
                .filter((message) => message.role === 'user')
                .map((message) => message.content)
                .join('\n\n');

            let generatedTitle: string | undefined;
            if (entryText.trim()) {
                try {
                    generatedTitle = await generateEntryTitle({ entryText });
                } catch (error) {
                    console.warn('AI title generation failed, using summary fallback', error);
                }
            }

            const { resolvedIntention } = await finishIntentionChat({
                messages,
                inputValue,
                draftCheckInId,
                intentionId,
                checkInType,
                personaId: activePersona?.id,
                intention,
                areaParam,
                isRefineMode,
                title: generatedTitle,
            });

            if (resolvedIntention && checkInType === 'intention') {
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
        }
    }, [
        activePersona?.id,
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
        router,
    ]);

    const handleSubmitInput = useCallback(async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || isLoading) {
            return;
        }
        setInputValue('');
        clearError();
        await handleSendMessage(trimmed);
    }, [clearError, handleSendMessage, isLoading]);

    const handleGoDeeper = useCallback(async () => {
        if (!trimmedInput || isLoading) {
            return;
        }
        const text = trimmedInput;
        setInputValue('');
        inputRef.current?.clear();
        clearError();
        await handleSendMessage(text);
    }, [clearError, handleSendMessage, isLoading, trimmedInput]);

    const handlePlay = (text: string) => {
        if (isMuted) return;
        Speech.speak(text);
    };

    const handleCopy = async (text: string) => {
        await Clipboard.setStringAsync(text);
    };

    const handleShare = async (text: string) => {
        await Share.share({ message: text });
    };

    const headerDate = useMemo(() => {
        const baseDate = draftUpdatedAt ? new Date(draftUpdatedAt) : new Date();
        return baseDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        });
    }, [draftUpdatedAt]);

    const handleToggleMuted = () => {
        setIsMuted((prev) => {
            const next = !prev;
            if (next) {
                Speech.stop();
            }
            return next;
        });
    };

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top', 'bottom']}>
            <View className="flex-1 max-w-md mx-auto w-full bg-background-light dark:bg-background-dark">
                <IntentionChatHeader
                    personaName={activePersona?.name ?? 'Rosebud'}
                    onOpenPersona={() => setPersonaSheetOpen(true)}
                    onOpenDrafts={() => router.push('/drafts')}
                    onClose={personaSheetOpen ? () => setPersonaSheetOpen(false) : handleClose}
                />

                <IntentionChatBody
                    scrollViewRef={scrollViewRef}
                    inputRef={inputRef}
                    flowLabel={flowLabel}
                    headerDate={headerDate}
                    messages={messages}
                    streamingMessage={streamingMessage}
                    isLoading={isLoading}
                    feedback={feedback}
                    onSubmitInput={handleSubmitInput}
                    onInputTextChange={setInputValue}
                    onSettingsPress={personaSettings.openActiveSettings}
                    onPlay={handlePlay}
                    onCopy={handleCopy}
                    onShare={handleShare}
                    onThumb={handleThumb}
                    onScroll={handleScroll}
                    onContentSizeChange={() => scrollToBottom()}
                />

                <IntentionChatFooter
                    isMuted={isMuted}
                    onToggleMuted={handleToggleMuted}
                    onGoDeeper={handleGoDeeper}
                    onFinishEntry={handleFinish}
                    disabled={isLoading || isSaving}
                    canGoDeeper={trimmedInput.length > 0}
                    canFinish={hasContent(messages) || trimmedInput.length > 0}
                />

                <IntentionChatOverlays
                    personaSheetOpen={personaSheetOpen}
                    personas={personas}
                    activePersona={activePersona}
                    setPersonaSheetOpen={setPersonaSheetOpen}
                    setActive={setActive}
                    personaSettings={personaSettings}
                    feedbackModalProps={feedbackModalProps}
                />
            </View>
        </SafeAreaView>
    );
}
