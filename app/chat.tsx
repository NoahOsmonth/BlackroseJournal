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
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatMessage } from '../components/ChatMessage';
import { FooterActions } from '../components/FooterActions';
import { Header } from '../components/Header';
import { InlineTypingInput, InlineTypingInputRef } from '../components/InlineTypingInput';
import { TintColors } from '../constants/theme';
import { ChatMode, useChatOrchestration } from '../features/chat';
import { generateTitle, hasContent, inferMoodEmoji } from '../hooks/useEntryUtils';
import { useJournalEntries } from '../hooks/useJournalEntries';
import { JournalEntry } from '../services/journalStorage.types';

interface ChatParams {
    mode?: ChatMode;
    promptPeriod?: PromptPeriod;
    entryId?: string;
}

export default function ChatScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<ChatParams>();
    const scrollViewRef = useRef<ScrollView>(null);
    const inputRef = useRef<InlineTypingInputRef>(null);
    const [isSaving, setIsSaving] = useState(false);
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

    const {
        messages,
        streamingMessage,
        isLoading,
        handleSendMessage,
        handleNewChat,
        initializeMessages,
        scrollToBottom,
        currentPrompt,
    } = useChatOrchestration({
        scrollViewRef,
        inputRef,
        mode: resolvedMode,
        promptPeriod: promptPeriod as PromptPeriod,
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
        handleNewChat();
        router.replace('/(tabs)/entries');
    }, [messages, handleNewChat, router, create, update, entryId, continuedEntry]);

    const handleFinishEntry = useCallback(async () => {
        if (!hasContent(messages) || isSaving) return;

        setIsSaving(true);
        try {
            const title = generateTitle(messages);
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
    }, [messages, isSaving, handleNewChat, router, create, update, entryId]);

    const canFinish = hasContent(messages) && !isLoading && !isSaving;

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
                                isStreaming={true}
                            />
                        )}

                        {isLoading && !streamingMessage && (
                            <View className="flex-row items-center gap-2 ml-4">
                                <ActivityIndicator size="small" color={TintColors.light} />
                                <Text className="text-slate-500 dark:text-slate-400 text-sm">AI is thinking...</Text>
                            </View>
                        )}

                        {/* Inline typing input - document style */}
                        {!isLoading && (
                            <InlineTypingInput
                                ref={inputRef}
                                onSubmit={handleSendMessage}
                                disabled={isLoading}
                                placeholder="Type your thoughts..."
                            />
                        )}
                    </View>
                </ScrollView>

                <FooterActions
                    onNewChat={handleNewChat}
                    onFinishEntry={handleFinishEntry}
                    disabled={isLoading || isSaving}
                    canFinish={canFinish}
                />
            </View>
        </SafeAreaView>
    );
}

