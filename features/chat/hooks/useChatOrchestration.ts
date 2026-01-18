/**
 * useChatOrchestration hook
 * 
 * Orchestrates chat state, streaming lifecycle, and side effects.
 * This hook handles:
 * - Message state management (user + assistant messages)
 * - Streaming message state during AI responses
 * - Loading state
 * - Scroll-to-bottom callbacks
 * - Input focus management
 */

import { useCallback, useState } from 'react';
import { Keyboard, ScrollView } from 'react-native';
import { InlineTypingInputRef } from '../../../components/InlineTypingInput';
import { Message, useChat } from '../../../services/ai';
import { StreamingMessage } from '../types';

export interface UseChatOrchestrationOptions {
    scrollViewRef: React.RefObject<ScrollView | null>;
    inputRef: React.RefObject<InlineTypingInputRef | null>;
}

export interface UseChatOrchestrationReturn {
    messages: Message[];
    streamingMessage: StreamingMessage | null;
    isLoading: boolean;
    handleSendMessage: (text: string) => Promise<void>;
    handleNewChat: () => void;
    scrollToBottom: () => void;
}

export function useChatOrchestration({
    scrollViewRef,
    inputRef,
}: UseChatOrchestrationOptions): UseChatOrchestrationReturn {
    const [messages, setMessages] = useState<Message[]>([]);
    const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { sendMessage, clearMessages } = useChat();

    const scrollToBottom = useCallback(() => {
        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
    }, [scrollViewRef]);

    const focusInput = useCallback(() => {
        setTimeout(() => {
            inputRef.current?.focus();
        }, 200);
    }, [inputRef]);

    const handleSendMessage = useCallback(async (text: string) => {
        Keyboard.dismiss();

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: text,
            timestamp: Date.now(),
        };

        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);
        scrollToBottom();

        const tempStreamingId = 'streaming-' + Date.now();
        setStreamingMessage({
            id: tempStreamingId,
            role: 'assistant',
            content: '',
            reasoning: '',
            isStreaming: true,
        });

        try {
            await sendMessage(
                text,
                (chunk, reasoning) => {
                    setStreamingMessage(prev => prev ? {
                        ...prev,
                        content: prev.content + chunk,
                        reasoning: prev.reasoning + (reasoning || ''),
                    } : null);
                    scrollToBottom();
                },
                (fullContent, fullReasoning) => {
                    setMessages(prev => [
                        ...prev,
                        {
                            id: tempStreamingId,
                            role: 'assistant',
                            content: fullContent,
                            reasoning: fullReasoning,
                            timestamp: Date.now(),
                        },
                    ]);
                    setStreamingMessage(null);
                    setIsLoading(false);
                    scrollToBottom();
                    focusInput();
                },
                (error) => {
                    console.error('AI Error:', error);
                    setStreamingMessage(null);
                    setIsLoading(false);
                    focusInput();
                }
            );
        } catch {
            setStreamingMessage(null);
            setIsLoading(false);
            focusInput();
        }
    }, [sendMessage, scrollToBottom, focusInput]);

    const handleNewChat = useCallback(() => {
        clearMessages();
        setMessages([]);
        setStreamingMessage(null);
        setIsLoading(false);
        inputRef.current?.clear();
        focusInput();
    }, [clearMessages, focusInput, inputRef]);

    return {
        messages,
        streamingMessage,
        isLoading,
        handleSendMessage,
        handleNewChat,
        scrollToBottom,
    };
}
