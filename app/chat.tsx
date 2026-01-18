/**
 * Chat Screen
 * 
 * Main chat screen for journaling - thin route component that composes UI and invokes hooks.
 * All state orchestration is delegated to useChatOrchestration hook.
 */

import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatMessage } from '../components/ChatMessage';
import { FooterActions } from '../components/FooterActions';
import { Header } from '../components/Header';
import { InlineTypingInput, InlineTypingInputRef } from '../components/InlineTypingInput';
import { TintColors } from '../constants/theme';
import { useChatOrchestration } from '../features/chat';
import { generateTitle, hasContent, inferMoodEmoji } from '../hooks/useEntryUtils';
import { createEntry } from '../services/journalStorage';

export default function ChatScreen() {
    const router = useRouter();
    const scrollViewRef = useRef<ScrollView>(null);
    const inputRef = useRef<InlineTypingInputRef>(null);
    const [isSaving, setIsSaving] = useState(false);

    const {
        messages,
        streamingMessage,
        isLoading,
        handleSendMessage,
        handleNewChat,
        scrollToBottom,
    } = useChatOrchestration({ scrollViewRef, inputRef });

    const handleClose = useCallback(async () => {
        // Save as draft if there's content
        if (hasContent(messages)) {
            try {
                const title = generateTitle(messages);
                const emoji = inferMoodEmoji(messages);

                await createEntry({
                    title,
                    emoji,
                    messages,
                    status: 'draft',
                });
            } catch (error) {
                console.error('Failed to save draft:', error);
            }
        }

        // Clear chat and navigate back to entries
        handleNewChat();
        router.replace('/(tabs)/entries');
    }, [messages, handleNewChat, router]);

    const handleFinishEntry = useCallback(async () => {
        if (!hasContent(messages) || isSaving) return;

        setIsSaving(true);
        try {
            const title = generateTitle(messages);
            const emoji = inferMoodEmoji(messages);

            await createEntry({
                title,
                emoji,
                messages,
                status: 'completed',
            });

            // Clear chat and navigate to entries
            handleNewChat();
            router.replace('/(tabs)/entries');
        } catch (error) {
            console.error('Failed to save entry:', error);
        } finally {
            setIsSaving(false);
        }
    }, [messages, isSaving, handleNewChat, router]);

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
                        {messages.map((message) => (
                            <ChatMessage
                                key={message.id}
                                isAi={message.role === 'assistant'}
                                text={message.content}
                                reasoning={message.reasoning}
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

