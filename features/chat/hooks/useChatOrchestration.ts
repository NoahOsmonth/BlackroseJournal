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
 * - Initial prompt context for daily check-in mode
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, ScrollView } from 'react-native';
import { InlineTypingInputRef } from '../../../components/InlineTypingInput';
import { DAILY_PROMPTS, DailyPrompt, PromptPeriod } from '../../../constants/dailyPrompts';
import { Message, useChat } from '../../../services/ai';
import { StreamingMessage } from '../types';

export type ChatMode = 'freeform' | 'dailyCheckIn' | 'continue';

export interface UseChatOrchestrationOptions {
    scrollViewRef: React.RefObject<ScrollView | null>;
    inputRef: React.RefObject<InlineTypingInputRef | null>;
    /** Chat mode - 'freeform' for regular chat, 'dailyCheckIn' for prompted check-in */
    mode?: ChatMode;
    /** Prompt period when in dailyCheckIn mode */
    promptPeriod?: PromptPeriod;
}

export interface UseChatOrchestrationReturn {
    messages: Message[];
    streamingMessage: StreamingMessage | null;
    isLoading: boolean;
    handleSendMessage: (text: string) => Promise<void>;
    handleNewChat: () => void;
    initializeMessages: (initialMessages: Message[]) => void;
    scrollToBottom: () => void;
    /** The prompt being used for daily check-in, if applicable */
    currentPrompt: DailyPrompt | null;
}

export function useChatOrchestration({
    scrollViewRef,
    inputRef,
    mode = 'freeform',
    promptPeriod,
}: UseChatOrchestrationOptions): UseChatOrchestrationReturn {
    const [messages, setMessages] = useState<Message[]>([]);
    const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { sendMessage, clearMessages, sendInitialPrompt, setMessages: setChatMessages } = useChat();
    const hasInitialized = useRef(false);

    // Get current prompt for daily check-in mode
    const currentPrompt = mode === 'dailyCheckIn' && promptPeriod
        ? DAILY_PROMPTS[promptPeriod]
        : null;

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

    // Trigger initial AI message for daily check-in mode
    useEffect(() => {
        if (mode === 'dailyCheckIn' && currentPrompt && !hasInitialized.current) {
            hasInitialized.current = true;

            // Start loading and trigger AI follow-up
            setIsLoading(true);
            const tempStreamingId = 'streaming-' + Date.now();
            setStreamingMessage({
                id: tempStreamingId,
                role: 'assistant',
                content: '',
                reasoning: '',
                isStreaming: true,
            });

            sendInitialPrompt(
                currentPrompt,
                (chunk, reasoning) => {
                    setStreamingMessage(prev => prev ? {
                        ...prev,
                        content: prev.content + chunk,
                        reasoning: prev.reasoning + (reasoning || ''),
                    } : null);
                    scrollToBottom();
                },
                (fullContent, fullReasoning) => {
                    setMessages([{
                        id: tempStreamingId,
                        role: 'assistant',
                        content: fullContent,
                        reasoning: fullReasoning,
                        timestamp: Date.now(),
                    }]);
                    setStreamingMessage(null);
                    setIsLoading(false);
                    scrollToBottom();
                    focusInput();
                },
                (error) => {
                    console.error('AI Error:', error);
                    // Fallback: show the prompt's AI follow-up text as the initial message
                    setMessages([{
                        id: tempStreamingId,
                        role: 'assistant',
                        content: currentPrompt.aiFollowUp,
                        timestamp: Date.now(),
                    }]);
                    setStreamingMessage(null);
                    setIsLoading(false);
                    focusInput();
                }
            );
        }
    }, [mode, currentPrompt, sendInitialPrompt, scrollToBottom, focusInput]);

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
        hasInitialized.current = false;
        clearMessages();
        setMessages([]);
        setStreamingMessage(null);
        setIsLoading(false);
        inputRef.current?.clear();
        focusInput();
    }, [clearMessages, focusInput, inputRef]);

    const initializeMessages = useCallback((initialMessages: Message[]) => {
        if (initialMessages.length === 0) return;
        hasInitialized.current = true;
        setMessages(initialMessages);
        setChatMessages(initialMessages);
        setStreamingMessage(null);
        setIsLoading(false);
        scrollToBottom();
    }, [scrollToBottom, setChatMessages]);

    return {
        messages,
        streamingMessage,
        isLoading,
        handleSendMessage,
        handleNewChat,
        initializeMessages,
        scrollToBottom,
        currentPrompt,
    };
}
