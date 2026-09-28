import React from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView, View } from 'react-native';

import { ChatErrorCard } from '@/components/chat/ChatErrorCard';
import { ChatMessage } from '@/components/ChatMessage';
import { InlineTypingInput, InlineTypingInputRef } from '@/components/InlineTypingInput';
import { TypingIndicator } from '@/components/ui/TypingIndicator';
import type { Message } from '@/services/ai/ai';
import type { StreamingMessage } from '@/features/chat';

interface ChatTranscriptProps {
    scrollViewRef: React.RefObject<ScrollView | null>;
    inputRef: React.Ref<InlineTypingInputRef>;
    messages: readonly Message[];
    streamingMessage: StreamingMessage | null;
    /** Turns restored from a saved entry render dimmed and read-only. */
    readOnlyMessageCount: number;
    isLoading: boolean;
    errorMessage?: string;
    canRetry?: boolean;
    onRetry?: () => void;
    onDismissError?: () => void;
    /** The "Show thinking" switch — false hides reasoning + tool calls. */
    showThinking?: boolean;
    onSubmitInput: (text: string) => void;
    onInputTextChange: (text: string) => void;
    /** Tapping the slip asks the transcript to come to its end. */
    onInputFocus?: () => void;
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onContentSizeChange?: () => void;
}

/**
 * The journal transcript: the scroll view, the turns, and the writing slip.
 *
 * The slip is the last child *inside* the scroll view on purpose — the writer's
 * line joins the flow like any other turn, and the verbs that act on it live in
 * the pinned bar outside (so they ride above the keyboard). Extracted from the
 * screen so `app/chat.tsx` stays a route: it wires state and renders.
 */
export function ChatTranscript({
    scrollViewRef,
    inputRef,
    messages,
    streamingMessage,
    readOnlyMessageCount,
    isLoading,
    errorMessage,
    canRetry = false,
    onRetry,
    onDismissError,
    showThinking = true,
    onSubmitInput,
    onInputTextChange,
    onInputFocus,
    onScroll,
    onContentSizeChange,
}: ChatTranscriptProps) {
    return (
        <ScrollView
            ref={scrollViewRef}
            className="flex-1 px-5 pt-5 pb-4"
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={80}
            onContentSizeChange={onContentSizeChange}
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
                        image={message.image}
                        showThinking={showThinking}
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
                        showThinking={showThinking}
                    />
                )}

                {isLoading && !streamingMessage && (
                    <View className="pl-5">
                        <TypingIndicator sizeClassName="text-sm" label="Thinking" />
                    </View>
                )}

                {errorMessage ? (
                    <ChatErrorCard
                        message={errorMessage}
                        onRetry={canRetry ? onRetry : undefined}
                        onDismiss={onDismissError}
                    />
                ) : null}

                {/* The writing slip lives in the transcript, not in a box below
                    it: your line appears in the flow like every other turn, and
                    the verbs that act on it sit in the pinned bar. */}
                <InlineTypingInput
                    ref={inputRef}
                    onSubmit={onSubmitInput}
                    onTextChange={onInputTextChange}
                    onFocusChange={(focused) => { if (focused) onInputFocus?.(); }}
                    disabled={isLoading}
                />
            </View>
        </ScrollView>
    );
}
