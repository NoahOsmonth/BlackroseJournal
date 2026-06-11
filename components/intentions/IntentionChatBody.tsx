import React from 'react';
import {
    ActivityIndicator,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Pressable,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Message } from '@/services/ai/ai';
import type { StreamingMessage } from '@/features/chat';
import { InlineTypingInput, InlineTypingInputRef } from '@/components/InlineTypingInput';
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
    const isDark = colorScheme === 'dark';
    const settingsIconColor = isDark ? Colors.dark.tabIconDefault : Colors.light.tabIconDefault;

    return (
        <ScrollView
            ref={scrollViewRef}
            className="flex-1 px-5 pt-4 pb-20"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScroll={onScroll}
            scrollEventThrottle={80}
            onContentSizeChange={onContentSizeChange}
        >
            <View className="flex-row items-center gap-2 mb-4">
                <Text className="text-[10px] font-bold tracking-wider text-text-secondary-light dark:text-text-secondary-dark uppercase">
                    {flowLabel} - {headerDate}
                </Text>
                <Pressable onPress={onSettingsPress} accessibilityLabel="Open persona settings">
                    <MaterialIcons name="settings" size={12} color={settingsIconColor} />
                </Pressable>
            </View>

            <View className="gap-4">
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

                {streamingMessage && (
                    <Text className="text-[17px] leading-relaxed text-accent-blue dark:text-ai-text">
                        {streamingMessage.content}
                    </Text>
                )}

                {isLoading && !streamingMessage && (
                    <View className="flex-row items-center gap-2 py-1" accessibilityLabel="Rosebud is thinking">
                        <ActivityIndicator size="small" color={settingsIconColor} />
                        <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                            Thinking...
                        </Text>
                    </View>
                )}
            </View>

            <View className="mt-8 pb-6">
                <InlineTypingInput
                    ref={inputRef}
                    onSubmit={onSubmitInput}
                    onTextChange={onInputTextChange}
                    disabled={isLoading}
                    placeholder="Write"
                />
            </View>
        </ScrollView>
    );
}
