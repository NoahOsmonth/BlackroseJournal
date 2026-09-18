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
import {
    type AgentActivityListener,
    type AgentToolCallSnapshot,
    reduceAgentToolSnapshots,
} from './agentEvents';
import { createTemporalMessage } from './messageTemporalMetadata';

export { buildDailyCheckInSystemPrompt };

export interface SendMessageExtras {
    onAgentActivity?: AgentActivityListener;
}

function appendAssistantMessage(
    messagesRef: React.MutableRefObject<Message[]>,
    fullContent: string,
    fullReasoning: string,
    onComplete: (fullContent: string, fullReasoning: string) => void,
    toolActivity?: AgentToolCallSnapshot[]
): void {
    const aiMessage: Message = createTemporalMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: fullContent,
        reasoning: fullReasoning,
        ...(toolActivity && toolActivity.length > 0 ? { toolActivity } : {}),
    });
    messagesRef.current = [...messagesRef.current, aiMessage];
    onComplete(fullContent, fullReasoning);
}

export function useChat() {
    const messagesRef = useRef<Message[]>([]);
    const systemPromptRef = useRef<string | undefined>(undefined);
    const conversationIdRef = useRef<string>(generateConversationId());
    const generationRef = useRef<GenerationSettings>(DEFAULT_GENERATION);
    /** Active generation's abort controller — stopGeneration aborts it. */
    const abortRef = useRef<AbortController | null>(null);

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
            onError: ErrorCallback,
            extras?: SendMessageExtras
        ) => {
            const userMessage: Message = createTemporalMessage({
                id: Date.now().toString(),
                role: 'user',
                content,
            });
            messagesRef.current = [...messagesRef.current, userMessage];
            const basePrompt = systemPromptRef.current || THERAPIST_SYSTEM_PROMPT;
            let collectedActivity: AgentToolCallSnapshot[] = [];
            const activityListener: AgentActivityListener | undefined = extras?.onAgentActivity
                ? (event) => {
                    collectedActivity = reduceAgentToolSnapshots(collectedActivity, event);
                    extras.onAgentActivity?.(event);
                }
                : undefined;

            const controller = new AbortController();
            abortRef.current = controller;
            try {
                await streamChat(
                    messagesRef.current,
                    onChunk,
                    (fullContent, fullReasoning) =>
                        appendAssistantMessage(
                            messagesRef,
                            fullContent,
                            fullReasoning,
                            onComplete,
                            collectedActivity
                        ),
                    onError,
                    {
                        systemPrompt: basePrompt,
                        conversationId: conversationIdRef.current,
                        generation: generationRef.current,
                        signal: controller.signal,
                        ...(activityListener ? { onAgentActivity: activityListener } : {}),
                    }
                );
            } finally {
                abortRef.current = null;
            }
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
            const triggerMessage: Message = createTemporalMessage({
                id: 'trigger-' + Date.now(),
                role: 'user',
                content: '[Start daily check-in]',
            });
            messagesRef.current = [triggerMessage];
            await streamChat(
                messagesRef.current,
                onChunk,
                (fullContent, fullReasoning) => {
                    const aiMessage: Message = createTemporalMessage({
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: fullContent,
                        reasoning: fullReasoning,
                    });
                    messagesRef.current = [aiMessage];
                    onComplete(fullContent, fullReasoning);
                },
                onError,
                {
                    systemPrompt: basePrompt,
                    conversationId: conversationIdRef.current,
                    generation: generationRef.current,
                    // Bootstrap turn: stream only — agent loop would block the opener on free models.
                    enableHistoryTools: false,
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
            const triggerMessage: Message = createTemporalMessage({
                id: 'trigger-' + Date.now(),
                role: 'user',
                content: triggerText,
            });
            messagesRef.current = [triggerMessage];
            await streamChat(
                messagesRef.current,
                onChunk,
                (fullContent, fullReasoning) => {
                    const aiMessage: Message = createTemporalMessage({
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: fullContent,
                        reasoning: fullReasoning,
                    });
                    messagesRef.current = [aiMessage];
                    onComplete(fullContent, fullReasoning);
                },
                onError,
                {
                    systemPrompt,
                    conversationId: conversationIdRef.current,
                    generation: generationRef.current,
                    // Bootstrap turn: stream only — agent loop would block the opener on free models.
                    enableHistoryTools: false,
                }
            );
        },
        []
    );

    const clearMessages = useCallback(() => {
        messagesRef.current = [];
        systemPromptRef.current = undefined;
    }, []);

    /** Aborts the active generation (user Stop). No-op when idle. */
    const stopGeneration = useCallback(() => {
        abortRef.current?.abort();
        abortRef.current = null;
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
        stopGeneration,
    };
}
