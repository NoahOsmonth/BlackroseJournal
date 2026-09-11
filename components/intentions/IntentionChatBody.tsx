import React from 'react';
import {
    NativeScrollEvent,
    NativeSyntheticEvent,
    Pressable,
    ScrollView,
    Text,
    View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeSettings } from '@/hooks/useThemeSettings';
import type { Message } from '@/services/ai/ai';
import type { StreamingMessage } from '@/features/chat';
import { AgentToolActivity } from '@/components/ai/AgentToolActivity';
import { InlineTypingInputRef } from '@/components/InlineTypingInput';
import { TypingIndicator } from '@/components/ui/TypingIndicator';
import { IntentionChatMessage } from './IntentionChatMessage';

interface IntentionChatBodyProps {
    readonly scrollViewRef: React.RefObject<ScrollView | null>;
    readonly inputRef: React.Ref<InlineTypingInputRef>;
    readonly flowLabel: string;
    readonly headerDate: string;
    readonly messages: readonly Message[];
    readonly streamingMessage: StreamingMessage | null;
    readonly isLoading: boolean;
    readonly feedback: Record<string, 'up' | 'down'>;
    readonly onSubmitInput: (text: string) => void;
    readonly onInputTextChange: (text: string) => void;
    readonly onSettingsPress: () => void;
    readonly onPlay: (text: string) => void;
    readonly onCopy: (text: string) => void;
    readonly onShare: (text: string) => void;
    readonly onThumb: (id: string, value: 'up' | 'down') => void;
    readonly onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    readonly onContentSizeChange?: () => void;
}

export function IntentionChatBody({
    scrollViewRef,
    inputRef,
    flowLabel,
    headerDate,
    messages,
    streamingMessage,
    isLoading,
    feedback,
    onSubmitInput,
    onInputTextChange,
    onSettingsPress,
    onPlay,
    onCopy,
    onShare,
    onThumb,
    onScroll,
    onContentSizeChange,
}: IntentionChatBodyProps) {
    const colorScheme = useColorScheme();
    const { colorTheme } = useThemeSettings();
    const isDark = colorScheme === 'dark';
    const colors = colorTheme.colors;
    const settingsIconColor = isDark ? colors.secondaryTextDark : colors.secondaryTextLight;
    const streamingTextColor = isDark ? colors.chatAiTextDark : colors.chatAiTextLight;

    return (
        <ScrollView
            ref={scrollViewRef}
            className="flex-1 px-5 pt-4 pb-6"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScroll={onScroll}
            scrollEventThrottle={80}
            onContentSizeChange={onContentSizeChange}
        >
            <View className="mb-5 flex-row items-center gap-2">
                <Text className="text-[11px] uppercase tracking-[1.5px] text-text-secondary-light dark:text-text-secondary-dark">
                    {flowLabel} · {headerDate}
                </Text>
                <Pressable
                    onPress={onSettingsPress}
                    accessibilityLabel="Open persona settings"
                    hitSlop={8}
                >
                    <MaterialIcons name="settings" size={14} color={settingsIconColor} />
                </Pressable>
            </View>

            <View className="gap-5">
                {messages.map((message) => (
                    <IntentionChatMessage
                        key={message.id}
                        message={message}
                        feedback={feedback[message.id]}
                        onPlay={onPlay}
                        onCopy={onCopy}
                        onShare={onShare}
                        onThumb={onThumb}
                    />
                ))}

                {(!!streamingMessage?.toolActivity?.length
                    || !!streamingMessage?.statusLines?.length) && (
                    <AgentToolActivity
                        toolActivity={streamingMessage.toolActivity ?? []}
                        statusLines={streamingMessage.statusLines}
                        compact={false}
                    />
                )}

                {streamingMessage && streamingMessage.content.length > 0 && (
                    <View className="flex-row">
                        <View className="mr-4 w-px self-stretch bg-bone-light dark:bg-bone-dark" />
                        <View className="min-w-0 flex-1">
                            <Text
                                className="text-[17px] leading-relaxed text-text-light dark:text-text-dark"
                                style={{ color: streamingTextColor }}
                            >
                                {streamingMessage.content}
                            </Text>
                        </View>
                    </View>
                )}

                {/* The streaming placeholder is created with empty content before
                    the first token arrives, so gate on content rather than on the
                    message's existence — otherwise this never shows. Show the
                    bare typing indicator only when no tool timeline is visible. */}
                {isLoading
                    && !streamingMessage?.content
                    && !streamingMessage?.toolActivity?.length
                    && !streamingMessage?.statusLines?.length && (
                    <View accessibilityLabel="Blackrose is thinking">
                        <TypingIndicator label="Thinking" />
                    </View>
                )}
            </View>

        </ScrollView>
    );
}
