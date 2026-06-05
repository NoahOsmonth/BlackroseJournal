import React from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Message } from '@/services/ai/ai';
import type { StreamingMessage } from '@/features/chat';
import { IntentionChatMessage } from './IntentionChatMessage';

interface IntentionChatBodyProps {
    readonly scrollViewRef: React.RefObject<ScrollView | null>;
    readonly headerDate: string;
    readonly messages: readonly Message[];
    readonly streamingMessage: StreamingMessage | null;
    readonly feedback: Record<string, 'up' | 'down'>;
    readonly inputValue: string;
    readonly onInputChange: (value: string) => void;
    readonly onSettingsPress: () => void;
    readonly onPlay: (text: string) => void;
    readonly onCopy: (text: string) => void;
    readonly onShare: (text: string) => void;
    readonly onThumb: (id: string, value: 'up' | 'down') => void;
}

export function IntentionChatBody({
    scrollViewRef,
    headerDate,
    messages,
    streamingMessage,
    feedback,
    inputValue,
    onInputChange,
    onSettingsPress,
    onPlay,
    onCopy,
    onShare,
    onThumb,
}: IntentionChatBodyProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const settingsIconColor = isDark ? Colors.dark.tabIconDefault : Colors.light.tabIconDefault;
    const placeholderColor = isDark ? Colors.dark.tabIconDefault : Colors.light.tabIconDefault;

    return (
        <ScrollView
            ref={scrollViewRef}
            className="flex-1 px-5 pt-4 pb-20"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
        >
            <View className="flex-row items-center space-x-2 mb-4">
                <Text className="text-[10px] font-bold tracking-wider text-text-secondary-light dark:text-text-secondary-dark uppercase">
                    Intention Setting - {headerDate}
                </Text>
                <Pressable onPress={onSettingsPress} accessibilityLabel="Open persona settings">
                    <MaterialIcons name="settings" size={12} color={settingsIconColor} />
                </Pressable>
            </View>

            <View className="space-y-4">
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
            </View>

            <View className="mt-8">
                <TextInput
                    testID="intention-chat-input"
                    value={inputValue}
                    onChangeText={onInputChange}
                    placeholder="Write"
                    placeholderTextColor={placeholderColor}
                    className="border-0 outline-none p-0 text-[17px] text-text-light dark:text-white"
                    multiline
                    autoFocus
                />
            </View>
        </ScrollView>
    );
}
