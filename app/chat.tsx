/** Chat screen — freeform / dailyCheckIn; orchestration lives in useChatOrchestration. */
import { PromptPeriod } from '@/constants/dailyPrompts';
import { useAiFeedback } from '@/hooks/feedback/useAiFeedback';
import { useGoalsContext } from '@/hooks/goals/useGoalsContext';
import { useIdentityContext } from '@/hooks/memory/useIdentityContext';
import { useLocalMemoryContext } from '@/hooks/memory/useLocalMemoryContext';
import { useRecentDaysContext } from '@/hooks/memory/useRecentDaysContext';
import { usePersonas } from '@/hooks/personas/usePersonas';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatModelPickerSheet } from '../components/ai/ChatModelPickerSheet';
import { ChatErrorCard } from '../components/chat/ChatErrorCard';
import { EntryFinishCelebration } from '../components/celebrations/EntryFinishCelebration';
import { ChatMessage } from '../components/ChatMessage';
import { FooterActions } from '../components/FooterActions';
import { Header } from '../components/Header';
import { InlineTypingInput, InlineTypingInputRef } from '../components/InlineTypingInput';
import { ChatPersonaSheet } from '../components/personas/ChatPersonaSheet';
import { TypingIndicator } from '../components/ui/TypingIndicator';
import { ChatMode, FLOWS, useChatOrchestration, useChatSessionFlush, useResumeChatSession } from '../features/chat';
import { useChatModelPicker } from '../hooks/settings/useChatModelPicker';
import { generateTitle, hasContent, inferMoodEmoji } from '../hooks/useEntryUtils';
import { useJournalEntries } from '../hooks/useJournalEntries';
import { generateEntryTitle } from '../services/ai';
import { runJournalFinishBackground } from '../services/journal/journalFinishSideEffects';
import type { JournalEntry } from '../services/journal/journalStorage.types';
import { withTimeout } from '../utils/async';
import { latestUserMemoryQuery, resolveMemoryCapsuleQuery } from '../utils/memoryCapsuleQuery';

type ChatParams = {
    mode?: string;
    promptPeriod?: string;
    entryId?: string;
    resume?: string;
    topic?: string;
};

/** Middle verb seed: opens the sentence, the writer finishes it. */
const NAME_FEELING_STEM = 'What I actually feel is ';

/**
 * The title call is the only AI step the writer waits on before the entry is
 * saved. A stalled provider must fall back to the local title instead of
 * holding Finish open.
 */
const FINISH_TITLE_TIMEOUT_MS = 8_000;

export default function ChatScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<ChatParams>();
    const scrollViewRef = useRef<ScrollView>(null);
    const inputRef = useRef<InlineTypingInputRef>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [finishStage, setFinishStage] = useState('Preparing your entry');
    const [showCelebration, setShowCelebration] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [continuedEntry, setContinuedEntry] = useState<JournalEntry | null>(null);
    const [readOnlyMessageCount, setReadOnlyMessageCount] = useState(0);
    const [personaSheetOpen, setPersonaSheetOpen] = useState(false);
    const { create, update, getById } = useJournalEntries();
    const { personas, activePersona, setActive } = usePersonas();
    const modelPicker = useChatModelPicker();
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
    // Long-term recall is tool-driven: the AI calls `recall_memory` on demand.
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
    });

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
    });

    // Resume an autosaved session: restore its messages (conversationId already
    // matches via the resume param).
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

        // Clear chat and navigate back to entries
        resetChatState();
        router.replace('/(tabs)/entries');
    }, [messages, resetChatState, router, create, update, entryId, continuedEntry, clearPersistedSession, finalize]);

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
                setShowCelebration(true);
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
    }, [messages, isSaving, router, create, update, entryId, handleNewChat, clearPersistedSession, finalize]);

    const canFinish = hasContent(messages) && !isLoading && !isSaving;
    const trimmedInput = inputValue.trim();
    const canGoDeeper = trimmedInput.length > 0 && !isLoading;

    const headerTitle = useMemo(() => {
        if (resolvedMode === 'continue') return 'Continue';
        if (resolvedMode === 'dailyCheckIn') {
            if (promptPeriod === 'morning') return 'Morning note';
            if (promptPeriod === 'evening') return 'Evening close';
        }
        return 'Journal';
    }, [promptPeriod, resolvedMode]);

    const handleGoDeeper = useCallback(async () => {
        if (!trimmedInput || isLoading) return;
        const message = trimmedInput;
        setInputValue('');
        inputRef.current?.clear();
        await handleSendMessage(message);
    }, [trimmedInput, isLoading, handleSendMessage]);

    // The middle verb seeds the slip rather than sending for the writer: the
    // affordance opens the sentence, it does not put words in their mouth.
    const handleNameFeeling = useCallback(() => {
        setInputValue(NAME_FEELING_STEM);
        inputRef.current?.setText(NAME_FEELING_STEM);
    }, []);

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top', 'bottom']}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
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
                />

                <ScrollView
                    ref={scrollViewRef}
                    className="flex-1 px-5 pt-5 pb-4"
                    contentContainerStyle={{ paddingBottom: 20 }}
                    showsVerticalScrollIndicator={false}
                    onScroll={handleScroll}
                    scrollEventThrottle={80}
                    onContentSizeChange={() => scrollToBottom()}
                    keyboardShouldPersistTaps="handled"
                >
                    <View className="gap-6">
                        {messages.map((message, index) => (
                            <ChatMessage
                                key={message.id}
                                isAi={message.role === 'assistant'}
                                text={message.content}
                                reasoning={message.reasoning}
                                isReadOnly={index < readOnlyMessageCount}
                                toolActivity={message.toolActivity}
                            />
                        ))}

                        {streamingMessage && (
                            <ChatMessage
                                key={streamingMessage.id}
                                isAi={true}
                                text={streamingMessage.content}
                                reasoning={streamingMessage.reasoning}
                                isStreaming={true}
                                toolActivity={streamingMessage.toolActivity}
                                statusLines={streamingMessage.statusLines}
                            />
                        )}

                        {isLoading && !streamingMessage && (
                            <View className="pl-5">
                                <TypingIndicator sizeClassName="text-sm" label="Thinking" />
                            </View>
                        )}

                        {errorMessage && (
                            <ChatErrorCard
                                message={errorMessage}
                                onRetry={canRetry ? retryLastMessage : undefined}
                                onDismiss={clearError}
                            />
                        )}
                    </View>
                </ScrollView>

                {/* Pinned block below the transcript — verbs, then the writing
                    slip. Kept outside the ScrollView so it never overlaps the
                    last message. The concept has no rule and no honesty line
                    here: the verbs simply float above the slip. */}
                <View className="gap-3 px-5 pb-2 pt-3">
                    <FooterActions
                        onGoDeeper={handleGoDeeper}
                        onNameFeeling={handleNameFeeling}
                        onFinishEntry={handleFinishEntry}
                        disabled={isLoading || isSaving}
                        canGoDeeper={canGoDeeper}
                        canFinish={canFinish}
                        isSaving={isSaving}
                        savingLabel={finishStage}
                    />

                    <InlineTypingInput
                        ref={inputRef}
                        onSubmit={handleSendMessage}
                        onTextChange={setInputValue}
                        disabled={isLoading}
                        placeholder="Write what's true…"
                    />
                </View>

                <ChatPersonaSheet
                    visible={personaSheetOpen}
                    personas={personas}
                    activePersona={activePersona}
                    onClose={() => setPersonaSheetOpen(false)}
                    onSelect={setActive}
                />

                <ChatModelPickerSheet visible={modelPicker.visible} mode={modelPicker.mode}
                    models={modelPicker.models}
                    recentModels={modelPicker.recentModels}
                    selectedId={modelPicker.selectedModelId}
                    freeOnly={modelPicker.freeOnly}
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
