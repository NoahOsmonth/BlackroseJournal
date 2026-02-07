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

const getFriendlyErrorMessage = (error: Error): string => {
    const message = error.message.toLowerCase();

    if (message.includes('agent_api_key') || message.includes('authorization') || message.includes('unauthorized')) {
        return 'Missing or invalid agent API key. Check AGENT_API_KEY on the backend and EXPO_PUBLIC_AGENT_API_KEY on the app.';
    }

    if (message.includes('agent_base_url')) {
        return 'Missing agent backend URL. Set EXPO_PUBLIC_AGENT_BASE_URL and restart the app.';
    }

    if (message.includes('failed to fetch') || message.includes('network')) {
        return 'Network error while contacting the AI. Please try again.';
    }

    return 'Something went wrong while contacting the AI. Please try again.';
};

export type ChatMode = 'freeform' | 'dailyCheckIn' | 'continue' | 'intention';

export interface UseChatOrchestrationOptions {
    scrollViewRef: React.RefObject<ScrollView | null>;
    inputRef: React.RefObject<InlineTypingInputRef | null>;
    /** Chat mode - 'freeform' for regular chat, 'dailyCheckIn' for prompted check-in */
    mode?: ChatMode;
    /** Prompt period when in dailyCheckIn mode */
    promptPeriod?: PromptPeriod;
    /** Stable conversation identifier for backend long-term memory */
    conversationId?: string;
    /** Optional custom initial prompt for non-daily check-ins */
    initialPrompt?: { systemPrompt: string; triggerText: string };
}

export interface UseChatOrchestrationReturn {
    messages: Message[];
    streamingMessage: StreamingMessage | null;
    isLoading: boolean;
    errorMessage: string | null;
    canRetry: boolean;
    handleSendMessage: (text: string) => Promise<void>;
    retryLastMessage: () => Promise<void>;
    clearError: () => void;
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
    conversationId,
    initialPrompt,
}: UseChatOrchestrationOptions): UseChatOrchestrationReturn {
    const [messages, setMessages] = useState<Message[]>([]);
    const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [lastUserMessage, setLastUserMessage] = useState<Message | null>(null);
    const {
        sendMessage,
        clearMessages,
        sendInitialPrompt,
        sendInitialMessage,
        setMessages: setChatMessages,
        setConversationId,
    } = useChat();
    const hasInitialized = useRef(false);

    // Get current prompt for daily check-in mode
    const currentPrompt = mode === 'dailyCheckIn' && promptPeriod
        ? DAILY_PROMPTS[promptPeriod]
        : null;

    useEffect(() => {
        if (conversationId) {
            setConversationId(conversationId);
        }
    }, [conversationId, setConversationId]);

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

    const beginStreaming = useCallback(() => {
        const tempStreamingId = 'streaming-' + Date.now();
        setStreamingMessage({
            id: tempStreamingId,
            role: 'assistant',
            content: '',
            reasoning: '',
            isStreaming: true,
        });
        setIsLoading(true);
        return tempStreamingId;
    }, []);

    const clearError = useCallback(() => {
        setErrorMessage(null);
    }, []);

    const handleAiError = useCallback((error: Error) => {
        console.error('AI Error:', error);
        setErrorMessage(getFriendlyErrorMessage(error));
        setStreamingMessage(null);
        setIsLoading(false);
        focusInput();
    }, [focusInput]);

    // Trigger initial AI message for custom prompts
    useEffect(() => {
        if (!initialPrompt || hasInitialized.current) {
            return;
        }

        hasInitialized.current = true;
        clearError();
        const tempStreamingId = beginStreaming();

        sendInitialMessage(
            initialPrompt.systemPrompt,
            initialPrompt.triggerText,
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
                setMessages([{
                    id: tempStreamingId,
                    role: 'assistant',
                    content: initialPrompt.triggerText,
                    timestamp: Date.now(),
                }]);
                handleAiError(error);
            }
        );
    }, [
        initialPrompt,
        beginStreaming,
        clearError,
        focusInput,
        handleAiError,
        scrollToBottom,
        sendInitialMessage,
    ]);

    // Trigger initial AI message for daily check-in mode
    useEffect(() => {
        if (mode === 'dailyCheckIn' && currentPrompt && !hasInitialized.current) {
            hasInitialized.current = true;

            // Start loading and trigger AI follow-up
            clearError();
            const tempStreamingId = beginStreaming();

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
                    // Fallback: show the prompt's AI follow-up text as the initial message
                    setMessages([{
                        id: tempStreamingId,
                        role: 'assistant',
                        content: currentPrompt.aiFollowUp,
                        timestamp: Date.now(),
                    }]);
                    handleAiError(error);
                }
            );
        }
    }, [mode, currentPrompt, sendInitialPrompt, scrollToBottom, focusInput, beginStreaming, clearError, handleAiError]);

    const handleSendMessage = useCallback(async (text: string) => {
        Keyboard.dismiss();

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: text,
            timestamp: Date.now(),
        };

        clearError();
        setMessages(prev => [...prev, userMessage]);
        setLastUserMessage(userMessage);
        scrollToBottom();

        const tempStreamingId = beginStreaming();

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
                handleAiError
            );
        } catch (error) {
            handleAiError(error instanceof Error ? error : new Error('Unknown error'));
        }
    }, [sendMessage, scrollToBottom, focusInput, beginStreaming, clearError, handleAiError]);

    const retryLastMessage = useCallback(async () => {
        if (!lastUserMessage || isLoading) {
            return;
        }

        clearError();
        const tempStreamingId = beginStreaming();
        scrollToBottom();
        setChatMessages(messages.filter(message => message.id !== lastUserMessage.id));

        try {
            await sendMessage(
                lastUserMessage.content,
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
                handleAiError
            );
        } catch (error) {
            handleAiError(error instanceof Error ? error : new Error('Unknown error'));
        }
    }, [beginStreaming, clearError, focusInput, handleAiError, isLoading, lastUserMessage, messages, scrollToBottom, sendMessage, setChatMessages]);

    const handleNewChat = useCallback(() => {
        hasInitialized.current = false;
        clearMessages();
        setMessages([]);
        setStreamingMessage(null);
        setIsLoading(false);
        setErrorMessage(null);
        setLastUserMessage(null);
        setConversationId();
        inputRef.current?.clear();
        focusInput();
    }, [clearMessages, focusInput, inputRef, setConversationId]);

    const initializeMessages = useCallback((initialMessages: Message[]) => {
        if (initialMessages.length === 0) return;
        hasInitialized.current = true;
        setMessages(initialMessages);
        setChatMessages(initialMessages);
        setStreamingMessage(null);
        setIsLoading(false);
        setErrorMessage(null);
        setLastUserMessage(null);
        scrollToBottom();
    }, [scrollToBottom, setChatMessages]);

    const canRetry = Boolean(lastUserMessage);

    return {
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
        currentPrompt,
    };
}
