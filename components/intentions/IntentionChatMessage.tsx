import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { resolveIntentionChatContent } from '@/constants/intentionChat';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeSettings } from '@/hooks/useThemeSettings';
import type { Message } from '@/services/ai/ai';

interface IntentionChatMessageProps {
    message: Message;
    feedback?: 'up' | 'down';
    onPlay: (text: string) => void;
    onCopy: (text: string) => void;
    onShare: (text: string) => void;
    onThumb: (id: string, value: 'up' | 'down') => void;
}

export function IntentionChatMessage({
    message,
    feedback,
    onPlay,
    onCopy,
    onShare,
    onThumb,
}: IntentionChatMessageProps) {
    const colorScheme = useColorScheme();
    const { colorTheme } = useThemeSettings();
    const isDark = colorScheme === 'dark';
    const colors = colorTheme.colors;
    const actionIconColor = isDark ? colors.chatAiTextDark : colors.chatAiTextLight;
    const activeActionIconColor = isDark ? colors.accentDark : colors.accentLight;
    const isAssistant = message.role === 'assistant';
    const displayContent = resolveIntentionChatContent(message.content);
    const messageTextColor = isAssistant
        ? actionIconColor
        : isDark ? colors.chatUserTextDark : colors.chatUserTextLight;

    return (
        <View className="gap-2">
            <Text
                testID="intention-chat-message-text"
                className={`max-w-[320px] text-[17px] leading-relaxed ${isAssistant
                    ? 'text-accent-blue dark:text-ai-text'
                    : 'text-user-text dark:text-user-text-dark'
                    }`}
                style={{ color: messageTextColor }}
            >
                {displayContent}
            </Text>
            {isAssistant && (
                <View className="flex-row items-center gap-5">
                    <Pressable onPress={() => onPlay(displayContent)} accessibilityLabel="Play message">
                        <MaterialIcons name="play-arrow" size={22} color={actionIconColor} />
                    </Pressable>
                    <Pressable onPress={() => onCopy(displayContent)} accessibilityLabel="Copy message">
                        <MaterialIcons name="content-copy" size={20} color={actionIconColor} />
                    </Pressable>
                    <Pressable onPress={() => onThumb(message.id, 'up')} accessibilityLabel="Thumbs up">
                        <MaterialIcons
                            name="thumb-up"
                            size={20}
                            color={feedback === 'up' ? activeActionIconColor : actionIconColor}
                        />
                    </Pressable>
                    <Pressable onPress={() => onThumb(message.id, 'down')} accessibilityLabel="Thumbs down">
                        <MaterialIcons
                            name="thumb-down"
                            size={20}
                            color={feedback === 'down' ? activeActionIconColor : actionIconColor}
                        />
                    </Pressable>
                    <Pressable onPress={() => onShare(displayContent)} accessibilityLabel="Share message">
                        <MaterialIcons name="ios-share" size={20} color={actionIconColor} />
                    </Pressable>
                </View>
            )}
        </View>
    );
}
