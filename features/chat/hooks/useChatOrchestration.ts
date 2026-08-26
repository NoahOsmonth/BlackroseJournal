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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Keyboard,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Platform,
    ScrollView,
} from 'react-native';
import { InlineTypingInputRef } from '../../../components/InlineTypingInput';
import { DAILY_PROMPTS, DailyPrompt, PromptPeriod } from '../../../constants/dailyPrompts';
import { DirectConfigError } from '../../../services/ai/directConfig';
import { Message, useChat } from '../../../services/ai';
import { createTemporalMessage } from '../../../services/ai/messageTemporalMetadata';
import { resolveGenerationSettings } from '../../../services/ai/generationSettings';
import {
    ChatSessionMode,
    pruneStaleSessions,
    removeSession,
    saveSession,
} from '../../../services/ai/sessionStorage';
import { scheduleIdentityExtractionFromTurn } from '../../../services/memory/identityExtraction';
import { useGenerationSettings } from '../../../hooks/settings/useGenerationSettings';
import type { ChatFlow, ChatFlowContext } from '../flows/types';
import { StreamingMessage } from '../types';

const PERSIST_DEBOUNCE_MS = 600;

const getFriendlyErrorMessage = (error: Error): string => {
    if (error instanceof DirectConfigError) {
        if (error.message.includes('EXPO_PUBLIC_NANO_GPT_API_KEY')) {
            return 'Missing or invalid NanoGPT API key. Set EXPO_PUBLIC_NANO_GPT_API_KEY and restart the app.';
        }
        if (error.message.includes('EXPO_PUBLIC_NANO_GPT_API_BASE_URL')) {
            return 'Missing NanoGPT base URL. Set EXPO_PUBLIC_NANO_GPT_API_BASE_URL and restart the app.';
        }
        return error.message;
    }

    const message = error.message.toLowerCase();

    if (message.includes('expo_public_nano_gpt_api_key') || message.includes('authorization') || message.includes('unauthorized')) {
        return 'Missing or invalid NanoGPT API key. Set EXPO_PUBLIC_NANO_GPT_API_KEY and restart the app.';
    }

    if (message.includes('expo_public_nano_gpt_api_base_url')) {
        return 'Missing NanoGPT base URL. Set EXPO_PUBLIC_NANO_GPT_API_BASE_URL and restart the app.';
    }

    if (message.includes('failed to fetch') || message.includes('network')) {
        return 'Network error while contacting the AI. Please try again.';
    }

    return 'Something went wrong while contacting the AI. Please try again.';
};

export type ChatMode = 'freeform' | 'dailyCheckIn' | 'continue' | 'intention';

/** Describes how a live conversation is autosaved to the session store for crash recovery. */
export interface ChatPersistOptions {
    conversationId: string;
    mode: ChatSessionMode;
    personaId?: string;
    routeParams?: Record<string, string>;
}

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
    /** Optional system prompt override for regular sends without starting a chat. */
    systemPrompt?: string;
    /**
     * Declarative flow descriptor. When provided, the system prompt is derived
     * from `flow.buildSystemPrompt(flowContext)` and (if defined) the opener
     * from `flow.openingMessage(flowContext)`. The string `systemPrompt` option
     * remains a fallback for incremental migration.
     */
    flow?: ChatFlow;
    /** Inputs consumed by the active `flow`. */
    flowContext?: ChatFlowContext;
    /**
     * Optional turn-resolved recall context. When provided (and a `flow` is active),
     * it is awaited before the send so the outgoing message's long-term recall lands
     * in the system prompt for THIS turn. The reactive `flowContext` path lags one
     * turn: it only updates after the message has already been frozen into the prompt.
     */
    resolveRecallContext?: (text: string) => Promise<string | undefined>;
    /** When provided, the conversation is debounced-autosaved to the session store. */
    persist?: ChatPersistOptions;
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
    /** Removes the autosaved session for the active conversation (call on finish/discard). */
    clearPersistedSession: () => Promise<void>;
    scrollToBottom: (options?: ScrollToBottomOptions) => void;
    handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    /** The prompt being used for daily check-in, if applicable */
    currentPrompt: DailyPrompt | null;
}

interface ScrollToBottomOptions {
    force?: boolean;
    animated?: boolean;
}

function isNearBottom(event: NativeScrollEvent): boolean {
    const { contentOffset, contentSize, layoutMeasurement } = event;
    const distance = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    return distance < 96;
}

export function useChatOrchestration({
    scrollViewRef,
    inputRef,
    mode = 'freeform',
    promptPeriod,
    conversationId,
    initialPrompt,
    systemPrompt,
    flow,
    flowContext,
    resolveRecallContext,
    persist,
}: UseChatOrchestrationOptions): UseChatOrchestrationReturn {
    const [messages, setMessages] = useState<Message[]>([]);
    const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [lastUserMessage, setLastUserMessage] = useState<Message | null>(null);
    const shouldAutoScrollRef = useRef(true);
    const {
        sendMessage,
        clearMessages,
        sendInitialPrompt,
        sendInitialMessage,
        setMessages: setChatMessages,
        setConversationId,
        setGenerationSettings,
        setSystemPrompt,
    } = useChat();
    const { settings: generationDefaults } = useGenerationSettings();
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

    // Derive the effective system prompt: a flow descriptor takes precedence,
    // falling back to the string `systemPrompt` option for incremental migrations.
    // Freeform topic seeds prepend an instruction; intention/morning/evening already
    // pass the flow prompt as initialPrompt.systemPrompt — do not double it.
    const resolvedSystemPrompt = useMemo(() => {
        const base = flow
            ? flow.buildSystemPrompt(flowContext ?? {})
            : systemPrompt;
        if (!initialPrompt?.systemPrompt || !base) {
            return base ?? initialPrompt?.systemPrompt;
        }
        const seed = initialPrompt.systemPrompt.trim();
        const baseTrimmed = base.trim();
        if (!seed || seed === baseTrimmed || baseTrimmed.startsWith(seed) || seed.startsWith(baseTrimmed)) {
            return base;
        }
        return `${initialPrompt.systemPrompt}\n\n${base}`;
    }, [flow, flowContext, systemPrompt, initialPrompt]);

    // Effective initial prompt: when a flow is active and the caller opted into
    // an opener (via `initialPrompt`), the flow drives the system prompt.
    // Static `openingMessage` is seeded as the first assistant turn (no AI wait);
    // only flows without a static opener still call the model for the bootstrap.
    const staticOpeningMessage = useMemo(() => {
        if (!initialPrompt || !flow?.openingMessage) return undefined;
        const opener = flow.openingMessage(flowContext ?? {}).trim();
        return opener.length > 0 ? opener : undefined;
    }, [initialPrompt, flow, flowContext]);

    const effectiveInitialPrompt = useMemo(() => {
        if (!initialPrompt) return undefined;
        if (staticOpeningMessage) return undefined;
        if (!flow) return initialPrompt;
        return {
            systemPrompt: resolvedSystemPrompt ?? initialPrompt.systemPrompt,
            triggerText: initialPrompt.triggerText,
        };
    }, [initialPrompt, flow, staticOpeningMessage, resolvedSystemPrompt]);

    useEffect(() => {
        const prompt = resolvedSystemPrompt ?? effectiveInitialPrompt?.systemPrompt ?? initialPrompt?.systemPrompt;
        if (prompt) {
            setSystemPrompt(prompt);
        }
    }, [resolvedSystemPrompt, effectiveInitialPrompt?.systemPrompt, initialPrompt?.systemPrompt, setSystemPrompt]);

    useEffect(() => {
        if (resolvedSystemPrompt) {
            setSystemPrompt(resolvedSystemPrompt);
        }
    }, [resolvedSystemPrompt, setSystemPrompt]);

    const effectiveGeneration = useMemo(() => resolveGenerationSettings(
        generationDefaults,
        flow?.generationOverride?.(flowContext ?? {}),
        flowContext?.activePersona?.imagination
    ), [flow, flowContext, generationDefaults]);

    useEffect(() => {
        setGenerationSettings(effectiveGeneration);
    }, [effectiveGeneration, setGenerationSettings]);

    // Keep the latest persist descriptor in a ref so the debounced save reads
    // current values without re-subscribing on every option change.
    const persistRef = useRef<ChatPersistOptions | undefined>(persist);
    persistRef.current = persist;

    // Prune stale/over-cap sessions once when a persistent chat mounts.
    useEffect(() => {
        if (!persist) return;
        void pruneStaleSessions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Debounced autosave: persist the conversation as it grows so a crash or a
    // fast unmount loses at most the last message.
    useEffect(() => {
        const target = persistRef.current;
        if (!target || messages.length === 0) return;

        const timer = setTimeout(() => {
            void saveSession({
                conversationId: target.conversationId,
                mode: target.mode,
                personaId: target.personaId,
                routeParams: target.routeParams,
                messages,
                updatedAt: Date.now(),
                createdAt: Date.now(),
            });
        }, PERSIST_DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [messages, persist?.conversationId, persist?.mode, persist?.personaId]);

    const clearPersistedSession = useCallback(async () => {
        const id = persistRef.current?.conversationId;
        if (!id) return;
        await removeSession(id);
    }, []);

    const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        shouldAutoScrollRef.current = isNearBottom(event.nativeEvent);
    }, []);

    const scrollToBottom = useCallback((options: ScrollToBottomOptions = {}) => {
        if (!options.force && !shouldAutoScrollRef.current) {
            return;
        }

        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: options.animated ?? true });
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

    // Seed static flow openers immediately (morning / evening / intention).
    // Avoids a free-model reasoning + agent-loop wait that leaves "…" on screen.
    useEffect(() => {
        if (!staticOpeningMessage || hasInitialized.current) {
            return;
        }
        hasInitialized.current = true;
        clearError();
        const openerMessage: Message = createTemporalMessage({
            id: `opener-${Date.now()}`,
            role: 'assistant',
            content: staticOpeningMessage,
        });
        setMessages([openerMessage]);
        setChatMessages([openerMessage], resolvedSystemPrompt ?? initialPrompt?.systemPrompt);
        setStreamingMessage(null);
        setIsLoading(false);
        scrollToBottom({ force: true });
        focusInput();
    }, [
        staticOpeningMessage,
        clearError,
        focusInput,
        initialPrompt?.systemPrompt,
        resolvedSystemPrompt,
        scrollToBottom,
        setChatMessages,
    ]);

    // Trigger initial AI message for custom prompts (no static flow opener)
    useEffect(() => {
        if (!effectiveInitialPrompt || hasInitialized.current) {
            return;
        }

        hasInitialized.current = true;
        clearError();
        const tempStreamingId = beginStreaming();
        scrollToBottom({ force: true });

        sendInitialMessage(
            effectiveInitialPrompt.systemPrompt,
            effectiveInitialPrompt.triggerText,
            (chunk, reasoning) => {
                setStreamingMessage(prev => prev ? {
                    ...prev,
                    content: prev.content + chunk,
                    reasoning: prev.reasoning + (reasoning || ''),
                } : null);
                scrollToBottom();
            },
            (fullContent, fullReasoning) => {
                setMessages([createTemporalMessage({
                    id: tempStreamingId,
                    role: 'assistant',
                    content: fullContent,
                    reasoning: fullReasoning,
                })]);
                setStreamingMessage(null);
                setIsLoading(false);
                scrollToBottom();
                focusInput();
            },
            (error) => {
                setMessages([createTemporalMessage({
                    id: tempStreamingId,
                    role: 'assistant',
                    content: effectiveInitialPrompt.triggerText,
                })]);
                handleAiError(error);
            }
        );
    }, [
        effectiveInitialPrompt,
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
            scrollToBottom({ force: true });

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
                setMessages([createTemporalMessage({
                    id: tempStreamingId,
                    role: 'assistant',
                    content: fullContent,
                    reasoning: fullReasoning,
                })]);
                    setStreamingMessage(null);
                    setIsLoading(false);
                    scrollToBottom();
                    focusInput();
                },
                (error) => {
                    // Fallback: show the prompt's AI follow-up text as the initial message
                    setMessages([createTemporalMessage({
                        id: tempStreamingId,
                        role: 'assistant',
                        content: currentPrompt.aiFollowUp,
                    })]);
                    handleAiError(error);
                }
            );
        }
    }, [mode, currentPrompt, sendInitialPrompt, scrollToBottom, focusInput, beginStreaming, clearError, handleAiError]);

    const handleSendMessage = useCallback(async (text: string) => {
        if (Platform.OS === 'web') console.warn(`[ORCH] handleSendMessage len=${text.length} isLoading=${isLoading}`);
        Keyboard.dismiss();

        const userMessage: Message = createTemporalMessage({
            id: Date.now().toString(),
            role: 'user',
            content: text,
        });

        clearError();
        setMessages(prev => [...prev, userMessage]);
        setLastUserMessage(userMessage);
        scrollToBottom({ force: true });

        // Core identity write path (deterministic + optional flash LLM). Fire-and-forget
        // so chat latency is unchanged; next turn sees updated ## Identity via subscribe.
        scheduleIdentityExtractionFromTurn(text);

        const tempStreamingId = beginStreaming();

        try {
            // Resolve this turn's long-term recall BEFORE freezing the prompt. The
            // reactive `flowContext` path only updates after this message lands, so it
            // would starve the reply of its own recall (first message got none).
            if (flow && resolveRecallContext) {
                const recall = await resolveRecallContext(text).catch(() => undefined);
                if (recall !== undefined) {
                    setSystemPrompt(flow.buildSystemPrompt({ ...flowContext, retrievedHistoryContext: recall }));
                }
            }

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
                        createTemporalMessage({
                            id: tempStreamingId,
                            role: 'assistant',
                            content: fullContent,
                            reasoning: fullReasoning,
                        }),
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
    }, [sendMessage, scrollToBottom, focusInput, beginStreaming, clearError, handleAiError, flow, resolveRecallContext, flowContext, setSystemPrompt]);

    const retryLastMessage = useCallback(async () => {
        if (!lastUserMessage || isLoading) {
            return;
        }

        clearError();
        const tempStreamingId = beginStreaming();
        scrollToBottom({ force: true });
        setChatMessages(messages.filter(message => message.id !== lastUserMessage.id));

        try {
            if (flow && resolveRecallContext) {
                const recall = await resolveRecallContext(lastUserMessage.content).catch(() => undefined);
                if (recall !== undefined) {
                    setSystemPrompt(flow.buildSystemPrompt({ ...flowContext, retrievedHistoryContext: recall }));
                }
            }

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
                        createTemporalMessage({
                            id: tempStreamingId,
                            role: 'assistant',
                            content: fullContent,
                            reasoning: fullReasoning,
                        }),
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
    }, [beginStreaming, clearError, focusInput, handleAiError, isLoading, lastUserMessage, messages, scrollToBottom, sendMessage, setChatMessages, flow, resolveRecallContext, flowContext, setSystemPrompt]);

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
        clearPersistedSession,
        scrollToBottom,
        handleScroll,
        currentPrompt,
    };
}
