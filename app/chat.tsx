/** Chat screen — freeform / dailyCheckIn; orchestration lives in useChatOrchestration. */
import { PromptPeriod } from '@/constants/dailyPrompts';
import { useAiFeedback } from '@/hooks/feedback/useAiFeedback';
import { useGoalsContext } from '@/hooks/goals/useGoalsContext';
import { useIdentityContext } from '@/hooks/memory/useIdentityContext';
import { useLocalMemoryContext } from '@/hooks/memory/useLocalMemoryContext';
import { useRecentDaysContext } from '@/hooks/memory/useRecentDaysContext';
import { usePersonas } from '@/hooks/personas/usePersonas';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatModelPickerSheet } from '../components/ai/ChatModelPickerSheet';
import { ChatComposerBar } from '../components/chat/ChatComposerBar';
import { ChatTranscript } from '../components/chat/ChatTranscript';
import { EntryFinishCelebration } from '../components/celebrations/EntryFinishCelebration';
import { Header } from '../components/Header';
import { InlineTypingInputRef } from '../components/InlineTypingInput';
import { ChatPersonaSheet } from '../components/personas/ChatPersonaSheet';
import { ChatMode, FLOWS, useChatOrchestration, useChatSessionFlush, useResumeChatSession } from '../features/chat';
import { useChatImagePicker } from '../hooks/chat/useChatImagePicker';
import { useJournalChatFinish } from '../hooks/chat/useJournalChatFinish';
import { useKeyboardAwareScroll } from '../hooks/chat/useKeyboardAwareScroll';
import { useReadAloud } from '../hooks/chat/useReadAloud';
import { useChatModelPicker } from '../hooks/settings/useChatModelPicker';
import { useChatViewSettings } from '../hooks/settings/useChatViewSettings';
import { hasContent } from '../hooks/useEntryUtils';
import { useJournalEntries } from '../hooks/useJournalEntries';
import type { JournalEntry } from '../services/journal/journalStorage.types';
import { latestUserMemoryQuery, resolveMemoryCapsuleQuery } from '../utils/memoryCapsuleQuery';

type ChatParams = {
    mode?: string;
    promptPeriod?: string;
    entryId?: string;
    resume?: string;
    topic?: string;
};

export default function ChatScreen() {
    const params = useLocalSearchParams<ChatParams>();
    const scrollViewRef = useRef<ScrollView>(null);
    const inputRef = useRef<InlineTypingInputRef>(null);
    const [showCelebration, setShowCelebration] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [continuedEntry, setContinuedEntry] = useState<JournalEntry | null>(null);
    const [readOnlyMessageCount, setReadOnlyMessageCount] = useState(0);
    const [personaSheetOpen, setPersonaSheetOpen] = useState(false);
    const { create, update, getById } = useJournalEntries();
    const { personas, activePersona, setActive } = usePersonas();
    const modelPicker = useChatModelPicker();
    const { showThinking, toggleShowThinking } = useChatViewSettings();
    const { pendingImage, isPicking, pickImage, removeImage, consumeImage } = useChatImagePicker();
    const { isSpeaking, toggle: toggleSpeech, stop: stopSpeech } = useReadAloud();
    const entryId = Array.isArray(params.entryId)
        ? params.entryId[0]
        : params.entryId;
    const resumeId = Array.isArray(params.resume) ? params.resume[0] : params.resume;
    const modeParam = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    const promptPeriod = Array.isArray(params.promptPeriod)
        ? params.promptPeriod[0]
        : params.promptPeriod;
    const topicParam = Array.isArray(params.topic) ? params.topic[0] : params.topic;
    const resolvedMode: ChatMode = modeParam === 'dailyCheckIn' || modeParam === 'continue'
        ? modeParam
        : 'freeform';
    // Resume keeps the original conversationId so backend long-term memory re-links;
    // otherwise reuse the entry id, or mint a fresh stable id for this session.
    const conversationId = useMemo(
        () => resumeId ?? entryId ?? `chat_${Date.now()}`,
        [resumeId, entryId]
    );
    const { guidance: feedbackGuidance } = useAiFeedback({
        scope: 'journal',
        personaId: activePersona?.id,
        conversationId,
    });
    // Live user text ranks the episodic capsule; title is only a continue-mode fallback.
    // Identity is injected separately and does not depend on this query.
    const [latestUserText, setLatestUserText] = useState<string | undefined>();
    const memoryCapsuleQuery = useMemo(
        () => resolveMemoryCapsuleQuery({
            latestUserText,
            continuedTitle: continuedEntry?.title,
        }),
        [latestUserText, continuedEntry?.title],
    );
    const { context: localMemoryContext } = useLocalMemoryContext({
        query: memoryCapsuleQuery,
    });
    const { context: recentDaysContext } = useRecentDaysContext({ days: 3 });
    const { context: identityContext } = useIdentityContext();
    const { goalsContext } = useGoalsContext();
    // Long-term recall is tool-driven: the AI calls `memory_search` on demand.
    // No blocking per-turn recall and no reactive open-time recall — the prompt's
    // `## Relevant long-term context` slot stays empty unless the tool fills it.
    const flow = resolvedMode === 'continue' ? FLOWS.continue : FLOWS.freeform;
    const flowContext = useMemo(
        () => ({
            activePersona,
            identityContext,
            localMemoryContext,
            recentDaysContext,
            goalsContext,
            feedbackGuidance,
        }),
        [
            activePersona, identityContext, localMemoryContext,
            recentDaysContext, goalsContext, feedbackGuidance,
        ]
    );

    const persist = useMemo(
        () => ({
            conversationId,
            mode: (resolvedMode === 'continue' ? 'continue' : 'freeform') as 'continue' | 'freeform',
            routeParams: entryId ? { entryId } : undefined,
        }),
        [conversationId, resolvedMode, entryId]
    );

    const initialPrompt = useMemo(() => {
        if (!topicParam) return undefined;
        return {
            systemPrompt: `The user tapped an insight about this topic. Begin by gently exploring it with them, building on their journal entries.\n\nTopic: ${topicParam}`,
            triggerText: topicParam,
        };
    }, [topicParam]);

    const {
        messages,
        streamingMessage,
        isLoading,
        errorMessage,
        canRetry,
        handleSendMessage,
        retryLastMessage,
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
        mode: resolvedMode,
        promptPeriod: promptPeriod as PromptPeriod,
        conversationId,
        flow,
        flowContext,
        persist,
        initialPrompt,
        getComposerDraft: () => inputValue,
    });

    // The composer bar rides above the keyboard via the avoiding view; this
    // keeps the writing slip itself in view when the keyboard covers it.
    useKeyboardAwareScroll(scrollToBottom);

    // After real user turns land, re-rank the capsule for the next model call.
    useEffect(() => {
        const next = latestUserMemoryQuery(messages);
        setLatestUserText((prev) => (prev === next ? prev : next));
    }, [messages]);

    // Flush the live conversation to the session store on blur/unmount, as a
    // backup to the debounced autosave inside the hook. finalize() suppresses
    // further flushes once the conversation is finished or explicitly closed.
    const { finalize } = useChatSessionFlush({
        conversationId,
        mode: resolvedMode === 'continue' ? 'continue' : 'freeform',
        messages,
        routeParams: entryId ? { entryId } : undefined,
        getComposerDraft: () => inputValue,
    });

    // Resume an autosaved session: restore its messages (conversationId already
    // matches via the resume param). Unsent composer text is restored too (DEF-007).
    useResumeChatSession({ resumeId, initializeMessages });

    useEffect(() => {
        let isActive = true;

        const loadEntry = async () => {
            if (!entryId) {
                setContinuedEntry(null);
                setReadOnlyMessageCount(0);
                return;
            }

            try {
                const entry = await getById(entryId);
                if (!isActive) return;

                if (entry) {
                    setContinuedEntry(entry);
                    setReadOnlyMessageCount(entry.messages.length);
                    initializeMessages(entry.messages);
                }
            } catch (error) {
                console.error('Failed to load entry:', error);
            }
        };

        loadEntry();

        return () => {
            isActive = false;
        };
    }, [entryId, getById, initializeMessages]);

    const resetChatState = useCallback(() => {
        setInputValue('');
        setLatestUserText(undefined);
        handleNewChat();
    }, [handleNewChat]);

    // Ending a sitting (draft or complete) is orchestration, not screen state:
    // it lives in the hook so this route only wires state and renders.
    const { handleClose, handleFinishEntry, isSaving, finishStage } = useJournalChatFinish({
        messages,
        entryId,
        continuedEntry,
        create,
        update,
        finalize,
        clearPersistedSession,
        handleNewChat,
        resetChatState,
        onCelebrate: () => setShowCelebration(true),
    });

    const canFinish = hasContent(messages) && !isLoading && !isSaving;
    const trimmedInput = inputValue.trim();
    const canGoDeeper = (trimmedInput.length > 0 || Boolean(pendingImage)) && !isLoading;
    const latestCompanionText = useMemo(() => {
        for (let index = messages.length - 1; index >= 0; index -= 1) {
            const message = messages[index];
            if (message.role === 'assistant' && message.content.trim()) return message.content;
        }
        return '';
    }, [messages]);

    const headerTitle = useMemo(() => {
        if (resolvedMode === 'continue') return 'Continue';
        if (resolvedMode === 'dailyCheckIn') {
            if (promptPeriod === 'morning') return 'Morning note';
            if (promptPeriod === 'evening') return 'Evening close';
        }
        return 'Journal';
    }, [promptPeriod, resolvedMode]);

    const handleGoDeeper = useCallback(async () => {
        if ((!trimmedInput && !pendingImage) || isLoading) return;
        const message = trimmedInput;
        const image = pendingImage ?? undefined;
        setInputValue('');
        inputRef.current?.clear();
        if (image) consumeImage();
        await handleSendMessage(message, image);
    }, [trimmedInput, pendingImage, isLoading, handleSendMessage, consumeImage]);

    /** Enter in the inline slip sends exactly what Go deeper sends. */
    const handleInlineSubmit = useCallback(async (text: string) => {
        const image = pendingImage ?? undefined;
        setInputValue('');
        if (image) consumeImage();
        await handleSendMessage(text, image);
    }, [handleSendMessage, pendingImage, consumeImage]);

    const handleToggleSpeech = useCallback(() => {
        if (isSpeaking) {
            stopSpeech();
            return;
        }
        if (latestCompanionText) toggleSpeech(latestCompanionText);
    }, [isSpeaking, latestCompanionText, stopSpeech, toggleSpeech]);

    // A reply must never keep talking after the sitting is left.
    useEffect(() => () => stopSpeech(), [stopSpeech]);

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top', 'bottom']}>
            <KeyboardAvoidingView behavior="padding" className="flex-1">
            <View className="flex-1 max-w-md mx-auto w-full bg-background-light dark:bg-background-dark">
                <Header
                    onClose={
                        personaSheetOpen
                            ? () => setPersonaSheetOpen(false)
                            : modelPicker.visible
                                ? modelPicker.close
                                : handleClose
                    }
                    title={headerTitle}
                    personaName={activePersona?.name ?? 'Blackrose'}
                    onPersonaPress={() => {
                        modelPicker.close();
                        setPersonaSheetOpen(true);
                    }}
                    onModelPress={() => {
                        setPersonaSheetOpen(false);
                        modelPicker.open();
                    }}
                    modelPickerDisabled={isLoading}
                    showThinking={showThinking}
                    onToggleThinking={() => { void toggleShowThinking(); }}
                />

                <ChatTranscript
                    scrollViewRef={scrollViewRef}
                    inputRef={inputRef}
                    messages={messages}
                    streamingMessage={streamingMessage}
                    readOnlyMessageCount={readOnlyMessageCount}
                    isLoading={isLoading}
                    errorMessage={errorMessage}
                    canRetry={canRetry}
                    onRetry={retryLastMessage}
                    onDismissError={clearError}
                    showThinking={showThinking}
                    onSubmitInput={handleInlineSubmit}
                    onInputTextChange={(text) => { setInputValue(text); noteComposerActivity(); }}
                    onInputFocus={() => scrollToBottom({ force: true })}
                    onScroll={handleScroll}
                    onContentSizeChange={() => scrollToBottom()}
                />

                {/* Pinned block below the transcript — the photo/voice icons,
                    a hairline, then the two verbs. Kept outside the ScrollView
                    so it rides above the keyboard instead of scrolling away. */}
                <ChatComposerBar
                    onGoDeeper={handleGoDeeper}
                    onFinishEntry={handleFinishEntry}
                    disabled={isLoading || isSaving}
                    canGoDeeper={canGoDeeper}
                    canFinish={canFinish}
                    isSaving={isSaving}
                    savingLabel={finishStage}
                    isStreaming={isLoading}
                    onStop={stopGeneration}
                    pendingImage={pendingImage}
                    onPickImage={() => { void pickImage(); }}
                    onRemoveImage={removeImage}
                    isPickingImage={isPicking}
                    voice={{
                        enabled: true,
                        speaking: isSpeaking,
                        label: isSpeaking ? 'Stop reading aloud' : 'Read the last reply aloud',
                        onPress: handleToggleSpeech,
                    }}
                />

                <ChatPersonaSheet
                    visible={personaSheetOpen}
                    personas={personas}
                    activePersona={activePersona}
                    onClose={() => setPersonaSheetOpen(false)}
                    onSelect={setActive}
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
                {showCelebration && <EntryFinishCelebration onDismiss={() => setShowCelebration(false)} />}
            </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
