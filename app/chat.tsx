/**
 * Chat Screen
 * 
 * Main chat screen for journaling - thin route component that composes UI and invokes hooks.
 * All state orchestration is delegated to useChatOrchestration hook.
 * 
 * Supports two modes:
 * - freeform: User-initiated chat (default)
 * - dailyCheckIn: Prompted check-in with AI greeting
 */

import { PromptPeriod } from '@/constants/dailyPrompts';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatMessage } from '../components/ChatMessage';
import { FooterActions } from '../components/FooterActions';
import { Header } from '../components/Header';
import { InlineTypingInput, InlineTypingInputRef } from '../components/InlineTypingInput';
import { TypingIndicator } from '../components/ui/TypingIndicator';
import { ChatMode, useChatOrchestration } from '../features/chat';
import { generateTitle, hasContent, inferMoodEmoji } from '../hooks/useEntryUtils';
import { useJournalEntries } from '../hooks/useJournalEntries';
import { generateEntryTitle } from '../services/ai';
import { JournalEntry } from '../services/journalStorage.types';

type ChatParams = {
    mode?: string;
    promptPeriod?: string;
    entryId?: string;
};

export default function ChatScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<ChatParams>();
    const scrollViewRef = useRef<ScrollView>(null);
    const inputRef = useRef<InlineTypingInputRef>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [continuedEntry, setContinuedEntry] = useState<JournalEntry | null>(null);
    const [readOnlyMessageCount, setReadOnlyMessageCount] = useState(0);
    const { create, update, getById } = useJournalEntries();

    const entryId = Array.isArray(params.entryId)
        ? params.entryId[0]
        : params.entryId;
    const modeParam = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    const promptPeriod = Array.isArray(params.promptPeriod)
        ? params.promptPeriod[0]
        : params.promptPeriod;
    const resolvedMode: ChatMode = modeParam === 'dailyCheckIn' || modeParam === 'continue'
        ? modeParam
        : 'freeform';
    const conversationId = useMemo(
        () => entryId ?? `chat_${Date.now()}`,
        [entryId]
    );

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
        scrollToBottom,
    } = useChatOrchestration({
        scrollViewRef,
        inputRef,
        mode: resolvedMode,
        promptPeriod: promptPeriod as PromptPeriod,
        conversationId,
    });

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
        handleNewChat();
    }, [handleNewChat]);

    const handleClose = useCallback(async () => {
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

        // Clear chat and navigate back to entries
        resetChatState();
        router.replace('/(tabs)/entries');
    }, [messages, resetChatState, router, create, update, entryId, continuedEntry]);

    const handleFinishEntry = useCallback(async () => {
        if (!hasContent(messages) || isSaving) return;

        setIsSaving(true);
        try {
            let title = generateTitle(messages); // Fallback
            try {
                const entryText = messages
                    .filter(m => m.role === 'user')
                    .map(m => m.content)
                    .join('\n\n');
                if (entryText.trim()) {
                    title = await generateEntryTitle({ entryText });
                }
            } catch (err) {
                console.warn('AI title generation failed, using fallback', err);
            }

            const emoji = inferMoodEmoji(messages);

            let savedEntryId = entryId;

            if (entryId) {
                await update(entryId, {
                    title,
                    emoji,
                    messages,
                    status: 'completed',
                });
            } else {
                const created = await create({
                    title,
                    emoji,
                    messages,
                    status: 'completed',
                });
                savedEntryId = created.id;
            }

            // Clear chat and navigate to post-finish reflection
            handleNewChat();
            if (savedEntryId) {
                router.replace({ pathname: '/entry-reflection', params: { entryId: savedEntryId } });
            } else {
                router.replace('/(tabs)/entries');
            }
        } catch (error) {
            console.error('Failed to save entry:', error);
        } finally {
            setIsSaving(false);
        }
    }, [messages, isSaving, resetChatState, router, create, update, entryId]);

    const canFinish = hasContent(messages) && !isLoading && !isSaving;
    const trimmedInput = inputValue.trim();
    const canGoDeeper = trimmedInput.length > 0 && !isLoading;

    const handleGoDeeper = useCallback(async () => {
        if (!trimmedInput || isLoading) return;
        const message = trimmedInput;
        setInputValue('');
        inputRef.current?.clear();
        await handleSendMessage(message);
    }, [trimmedInput, isLoading, handleSendMessage]);

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full bg-background-light dark:bg-background-dark">
                <Header onClose={handleClose} />

                <ScrollView
                    ref={scrollViewRef}
                    className="flex-1 px-6 py-4 space-y-6"
                    contentContainerStyle={{ paddingBottom: 20 }}
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={scrollToBottom}
                    keyboardShouldPersistTaps="handled"
                >
                    <View className="gap-y-4">
                        {messages.map((message, index) => (
                            <ChatMessage
                                key={message.id}
                                isAi={message.role === 'assistant'}
                                text={message.content}
                                reasoning={message.reasoning}
                                isReadOnly={index < readOnlyMessageCount}
                            />
                        ))}

                        {streamingMessage && (
                            <ChatMessage
                                key={streamingMessage.id}
                                isAi={true}
                                text={streamingMessage.content}
                                reasoning={streamingMessage.reasoning}
                                isStreaming={true}
                            />
                        )}

                        {isLoading && !streamingMessage && (
                            <View className="flex-row items-center gap-2 ml-4">
                                <TypingIndicator colorClassName="text-slate-500 dark:text-slate-400" sizeClassName="text-sm" />
                                <Text className="text-slate-500 dark:text-slate-400 text-sm">AI is thinking</Text>
                            </View>
                        )}

                        {errorMessage && (
                            <View
                                accessibilityRole="alert"
                                accessibilityLabel={errorMessage}
                                className="rounded-xl border border-divider-light dark:border-divider-dark bg-yellow-300/20 dark:bg-yellow-300/10 p-3"
                            >
                                <Text className="text-text-light dark:text-text-dark text-sm">
                                    {errorMessage}
                                </Text>
                                <View className="flex-row items-center justify-end gap-3 mt-3">
                                    {canRetry && (
                                        <Pressable
                                            onPress={retryLastMessage}
                                            accessibilityRole="button"
                                            accessibilityLabel="Retry AI request"
                                            className="px-3 py-1.5 rounded-full bg-primary"
                                        >
                                            <Text className="text-surface-light text-xs font-semibold">Retry</Text>
                                        </Pressable>
                                    )}
                                    <Pressable
                                        onPress={clearError}
                                        accessibilityRole="button"
                                        accessibilityLabel="Dismiss error message"
                                        className="px-2 py-1"
                                    >
                                        <Text className="text-text-secondary-light dark:text-text-secondary-dark text-xs">
                                            Dismiss
                                        </Text>
                                    </Pressable>
                                </View>
                            </View>
                        )}

                        {/* Inline typing input - document style */}
                        {!isLoading && (
                            <InlineTypingInput
                                ref={inputRef}
                                onSubmit={handleSendMessage}
                                onTextChange={setInputValue}
                                disabled={isLoading}
                                placeholder="Type your thoughts..."
                            />
                        )}

                        <View className="pt-4">
                            <FooterActions
                                onGoDeeper={handleGoDeeper}
                                onFinishEntry={handleFinishEntry}
                                disabled={isLoading || isSaving}
                                canGoDeeper={canGoDeeper}
                                canFinish={canFinish}
                            />
                        </View>
                    </View>
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}

