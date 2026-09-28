import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import * as Clipboard from 'expo-clipboard';

import { useChatOrchestration, useChatSessionFlush, useResumeChatSession } from '@/features/chat';
import { removeSession } from '@/services/ai/sessionStorage';
import { InlineTypingInputRef } from '@/components/InlineTypingInput';
import { usePersonas } from '@/hooks/personas/usePersonas';
import { useIntentionCheckIns } from '@/hooks/intentions/useIntentionCheckIns';
import { useIntentionChatFlowContext } from '@/hooks/intentions/useIntentionChatFlowContext';
import {
    getCheckIn,
    getIntention,
} from '@/services/intentions/intentionsStorage';
import { Intention, IntentionArea, IntentionCheckInType } from '@/services/intentions/intentionsStorage.types';
import { getIntentionAreaConfig } from '@/constants/intentions';
import { hasContent } from '@/hooks/journal/useEntryUtils';
import { ChatModelPickerSheet } from '@/components/ai/ChatModelPickerSheet';
import { IntentionChatHeader } from '@/components/intentions/IntentionChatHeader';
import { IntentionChatComposerBar } from '@/components/intentions/IntentionChatComposerBar';
import { IntentionChatBody } from '@/components/intentions/IntentionChatBody';
import { IntentionChatOverlays } from '@/components/intentions/IntentionChatOverlays';
import { useAiFeedback } from '@/hooks/feedback/useAiFeedback';
import { useIntentionFeedbackModal } from '@/hooks/feedback/useIntentionFeedbackModal';
import { useChatModelPicker } from '@/hooks/settings/useChatModelPicker';
import { useChatViewSettings } from '@/hooks/settings/useChatViewSettings';
import { useChatImagePicker } from '@/hooks/chat/useChatImagePicker';
import { useKeyboardAwareScroll } from '@/hooks/chat/useKeyboardAwareScroll';
import type { AiFeedbackValue } from '@/services/feedback/feedbackStorage';
import { usePersonaSettingsActions } from '@/hooks/personas/usePersonaSettingsActions';
import { useIntentionChatPersist } from '@/hooks/intentions/useIntentionChatPersist';
import { useIntentionChatFinish } from '@/hooks/intentions/useIntentionChatFinish';
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
    const modelPicker = useChatModelPicker();
    const { showThinking, toggleShowThinking } = useChatViewSettings();
    const { pendingImage, isPicking, pickImage, removeImage, consumeImage } = useChatImagePicker();
    const [isMuted, setIsMuted] = useState(false);

    const areaParam = Array.isArray(params.area) ? params.area[0] : params.area;
    const intentionId = Array.isArray(params.intentionId) ? params.intentionId[0] : params.intentionId;
    const typeParam = Array.isArray(params.type) ? params.type[0] : params.type;
    const modeParam = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    const draftIdParam = Array.isArray(params.draftId) ? params.draftId[0] : params.draftId;
    const resumeId = Array.isArray(params.resume) ? params.resume[0] : params.resume;

    const checkInType = (typeParam as IntentionCheckInType) ?? 'intention';
    const trimmedInput = inputValue.trim();
    const flowLabel = checkInType === 'morning'
        ? 'Morning intention'
        : checkInType === 'evening' ? 'Evening close' : 'Intention setting';
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

    const feedback = useMemo<Record<string, AiFeedbackValue>>(() => Object.fromEntries(
        Object.entries(feedbackByMessageId).map(([id, record]) => [id, record.value])
    ) as Record<string, AiFeedbackValue>, [feedbackByMessageId]);

    const isRefineMode = modeParam === 'refine';
    const { flow, flowContext } = useIntentionChatFlowContext({
        activePersona,
        areaLabel: areaConfig?.label,
        intentionTitle: intention?.title,
        intentionId,
        memorySummary,
        feedbackGuidance,
        checkInType,
        isRefineMode,
    });

    const initialPrompt = useMemo(() => {
        if (resumeId || draftIdParam || draftCheckInId || isFeedbackLoading || isPersonasLoading) {
            return undefined;
        }
        return {
            systemPrompt: flow.buildSystemPrompt(flowContext),
            triggerText: '[Start intention check-in]',
        };
    }, [resumeId, draftCheckInId, draftIdParam, isFeedbackLoading, isPersonasLoading, flow, flowContext]);

    const { checkInMode, persistRouteParams, persist } = useIntentionChatPersist({
        conversationId,
        checkInType,
        personaId: activePersona?.id,
        intentionId,
        areaParam,
        typeParam,
        modeParam,
    });

    const {
        messages,
        streamingMessage,
        isLoading,
        handleSendMessage,
        clearError,
        handleNewChat,
        initializeMessages,
        clearPersistedSession,
        stopGeneration,
        noteComposerActivity,
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
        getComposerDraft: () => inputValue,
    });

    // The composer bar rides above the keyboard via the avoiding view; this
    // keeps the writing slip itself in view when the keyboard covers it.
    useKeyboardAwareScroll(scrollToBottom);

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

    // Ending a check-in (draft or complete) is orchestration, not screen state.
    const { handleClose, handleFinish, isSaving, finishStage } = useIntentionChatFinish({
        messages,
        inputValue,
        conversationId,
        checkInType,
        draftCheckInId,
        intentionId,
        intention,
        areaParam,
        personaId: activePersona?.id,
        isRefineMode,
        finalize,
        clearPersistedSession,
        removeSession,
        handleNewChat,
        onDraftSaved: setDraftCheckInId,
    });

    const handleSubmitInput = useCallback(async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || isLoading) {
            return;
        }
        const image = pendingImage ?? undefined;
        setInputValue('');
        clearError();
        if (image) consumeImage();
        await handleSendMessage(trimmed, image);
    }, [clearError, handleSendMessage, isLoading, pendingImage, consumeImage]);

    const handleGoDeeper = useCallback(async () => {
        if ((!trimmedInput && !pendingImage) || isLoading) {
            return;
        }
        const text = trimmedInput;
        const image = pendingImage ?? undefined;
        setInputValue('');
        inputRef.current?.clear();
        clearError();
        if (image) consumeImage();
        await handleSendMessage(text, image);
    }, [clearError, handleSendMessage, isLoading, trimmedInput, pendingImage, consumeImage]);

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
            <KeyboardAvoidingView behavior="padding" className="flex-1">
            <View className="flex-1 max-w-md mx-auto w-full bg-background-light dark:bg-background-dark">
                <IntentionChatHeader
                    personaName={activePersona?.name ?? 'Blackrose'}
                    onOpenPersona={() => {
                        modelPicker.close();
                        setPersonaSheetOpen(true);
                    }}
                    onOpenDrafts={() => router.push('/drafts')}
                    onClose={
                        personaSheetOpen
                            ? () => setPersonaSheetOpen(false)
                            : modelPicker.visible
                                ? modelPicker.close
                                : handleClose
                    }
                    onOpenModelPicker={() => {
                        setPersonaSheetOpen(false);
                        modelPicker.open();
                    }}
                    modelPickerDisabled={isLoading}
                    showThinking={showThinking}
                    onToggleThinking={() => { void toggleShowThinking(); }}
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
                    onInputTextChange={(text) => { setInputValue(text); noteComposerActivity(); }}
                    onSettingsPress={personaSettings.openActiveSettings}
                    onPlay={handlePlay}
                    onCopy={handleCopy}
                    onShare={handleShare}
                    onThumb={handleThumb}
                    showThinking={showThinking}
                    onInputFocus={() => scrollToBottom({ force: true })}
                    onScroll={handleScroll}
                    onContentSizeChange={() => scrollToBottom()}
                />

                <IntentionChatComposerBar
                    isMuted={isMuted}
                    onToggleMuted={handleToggleMuted}
                    onGoDeeper={handleGoDeeper}
                    onFinishEntry={handleFinish}
                    disabled={isLoading || isSaving}
                    canGoDeeper={trimmedInput.length > 0 || Boolean(pendingImage)}
                    canFinish={hasContent(messages) || trimmedInput.length > 0}
                    isSaving={isSaving}
                    savingLabel={finishStage}
                    isStreaming={isLoading}
                    onStop={stopGeneration}
                    pendingImage={pendingImage}
                    onPickImage={() => { void pickImage(); }}
                    onRemoveImage={removeImage}
                    isPickingImage={isPicking}
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

                <ChatModelPickerSheet visible={modelPicker.visible}
                    models={modelPicker.models}
                    recentModels={modelPicker.recentModels}
                    selectedId={modelPicker.selectedModelId}
                    filterPatterns={modelPicker.filterPatterns}
                    hostLabel={modelPicker.hostLabel}
                    hasApiKey={modelPicker.hasApiKey}
                    isLoading={modelPicker.isLoading}
                    isFetching={modelPicker.isFetching}
                    error={modelPicker.error}
                    onSelect={modelPicker.selectModel}
                    onRefresh={modelPicker.refreshModels}
                    onClose={modelPicker.close}
                    onOpenSettings={modelPicker.openSettings}
                />
            </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
