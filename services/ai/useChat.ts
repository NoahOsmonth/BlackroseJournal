import { THERAPIST_SYSTEM_PROMPT } from '@/constants/aiPrompts';
import { DailyPrompt } from '@/constants/dailyPrompts';
import { useCallback, useRef } from 'react';
import { streamChat } from './ai';
import { buildDailyCheckInSystemPrompt } from './dailyCheckInPrompt';
import {
    DEFAULT_GENERATION,
    GenerationSettings,
    sanitizeGenerationSettings,
} from './generationSettings';
import {
    CompleteCallback,
    ErrorCallback,
    generateConversationId,
    Message,
    StreamingCallback,
} from './chatTypes';

export { buildDailyCheckInSystemPrompt };

function appendAssistantMessage(
    messagesRef: React.MutableRefObject<Message[]>,
    fullContent: string,
    fullReasoning: string,
    onComplete: (fullContent: string, fullReasoning: string) => void
): void {
    const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: fullContent,
        reasoning: fullReasoning,
        timestamp: Date.now(),
    };
    messagesRef.current = [...messagesRef.current, aiMessage];
    onComplete(fullContent, fullReasoning);
}

export function useChat() {
    const messagesRef = useRef<Message[]>([]);
    const systemPromptRef = useRef<string | undefined>(undefined);
    const conversationIdRef = useRef<string>(generateConversationId());
    const generationRef = useRef<GenerationSettings>(DEFAULT_GENERATION);

    const setMessages = useCallback((messages: Message[], systemPrompt?: string) => {
        messagesRef.current = messages;
        systemPromptRef.current = systemPrompt;
    }, []);

    const setConversationId = useCallback((conversationId?: string) => {
        conversationIdRef.current = conversationId || generateConversationId();
    }, []);

    const setSystemPrompt = useCallback((systemPrompt?: string) => {
        systemPromptRef.current = systemPrompt;
    }, []);

    const setGenerationSettings = useCallback((settings?: Partial<GenerationSettings>) => {
        generationRef.current = sanitizeGenerationSettings(settings);
    }, []);

    const sendMessage = useCallback(
        async (
            content: string,
            onChunk: StreamingCallback,
            onComplete: CompleteCallback,
            onError: ErrorCallback
        ) => {
            const userMessage: Message = {
                id: Date.now().toString(),
                role: 'user',
                content,
                timestamp: Date.now(),
            };
            messagesRef.current = [...messagesRef.current, userMessage];
            const basePrompt = systemPromptRef.current || THERAPIST_SYSTEM_PROMPT;
            await streamChat(
                messagesRef.current,
                onChunk,
                (fullContent, fullReasoning) => appendAssistantMessage(messagesRef, fullContent, fullReasoning, onComplete),
                onError,
                {
                    systemPrompt: basePrompt,
                    conversationId: conversationIdRef.current,
                    generation: generationRef.current,
                }
            );
        },
        []
    );

    const sendInitialPrompt = useCallback(
        async (
            prompt: DailyPrompt,
            onChunk: StreamingCallback,
            onComplete: CompleteCallback,
            onError: ErrorCallback
        ) => {
            const basePrompt = buildDailyCheckInSystemPrompt(prompt);
            systemPromptRef.current = basePrompt;
            const triggerMessage: Message = {
                id: 'trigger-' + Date.now(),
                role: 'user',
                content: '[Start daily check-in]',
                timestamp: Date.now(),
            };
            messagesRef.current = [triggerMessage];
            await streamChat(
                messagesRef.current,
                onChunk,
                (fullContent, fullReasoning) => {
                    const aiMessage: Message = {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: fullContent,
                        reasoning: fullReasoning,
                        timestamp: Date.now(),
                    };
                    messagesRef.current = [aiMessage];
                    onComplete(fullContent, fullReasoning);
                },
                onError,
                {
                    systemPrompt: basePrompt,
                    conversationId: conversationIdRef.current,
                    generation: generationRef.current,
                }
            );
        },
        []
    );

    const sendInitialMessage = useCallback(
        async (
            systemPrompt: string,
            triggerText: string,
            onChunk: StreamingCallback,
            onComplete: CompleteCallback,
            onError: ErrorCallback
        ) => {
            systemPromptRef.current = systemPrompt;
            const triggerMessage: Message = {
                id: 'trigger-' + Date.now(),
                role: 'user',
                content: triggerText,
                timestamp: Date.now(),
            };
            messagesRef.current = [triggerMessage];
            await streamChat(
                messagesRef.current,
                onChunk,
                (fullContent, fullReasoning) => {
                    const aiMessage: Message = {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: fullContent,
                        reasoning: fullReasoning,
                        timestamp: Date.now(),
                    };
                    messagesRef.current = [aiMessage];
                    onComplete(fullContent, fullReasoning);
                },
                onError,
                {
                    systemPrompt,
                    conversationId: conversationIdRef.current,
                    generation: generationRef.current,
                }
            );
        },
        []
    );

    const clearMessages = useCallback(() => {
        messagesRef.current = [];
        systemPromptRef.current = undefined;
    }, []);

    return {
        sendMessage,
        sendInitialPrompt,
        sendInitialMessage,
        setMessages,
        setConversationId,
        setSystemPrompt,
        setGenerationSettings,
        clearMessages,
    };
}
