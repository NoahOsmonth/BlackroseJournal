import React from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { resolveIntentionChatContent } from '@/constants/intentionChat';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeSettings } from '@/hooks/useThemeSettings';
import { AgentToolActivity } from '@/components/ai/AgentToolActivity';
import type { Message } from '@/services/ai/ai';

interface IntentionChatMessageProps {
    message: Message;
    feedback?: 'up' | 'down';
    onPlay: (text: string) => void;
    onCopy: (text: string) => void;
    onShare: (text: string) => void;
    onThumb: (id: string, value: 'up' | 'down') => void;
}

/**
 * Check-in chat turn, same presentation law as the journal chat: your words on
 * a right-aligned surface slip, the companion's on a bone left rule.
 */
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
    const actionIconColor = isDark ? colors.secondaryTextDark : colors.secondaryTextLight;
    const activeActionIconColor = isDark ? colors.accentDark : colors.accentLight;
    const isAssistant = message.role === 'assistant';
    const displayContent = resolveIntentionChatContent(message.content);
    const messageTextColor = isAssistant
        ? actionIconColor
        : isDark ? colors.chatUserTextDark : colors.chatUserTextLight;
    const reduceMotion = useReducedMotion();

    const actions = isAssistant ? (
        <View className="mt-3 flex-row items-center gap-5">
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
    ) : null;

    return (
        <Animated.View
            className="gap-2"
            entering={reduceMotion ? undefined : FadeInDown.duration(250).springify()}
        >
            {isAssistant ? (
                <View className="flex-row">
                    <View className="mr-4 w-px self-stretch bg-bone-light dark:bg-bone-dark" />
                    <View className="min-w-0 flex-1 gap-2">
                        {!!message.toolActivity?.length && (
                            <AgentToolActivity toolActivity={message.toolActivity} compact />
                        )}
                        <Text
                            testID="intention-chat-message-text"
                            className="text-[17px] leading-relaxed text-text-light dark:text-text-dark"
                            style={{ color: messageTextColor }}
                        >
                            {displayContent}
                        </Text>
                        {actions}
                    </View>
                </View>
            ) : (
                <View className="items-end">
                    <View className="max-w-[320px] rounded-card bg-surface-2-light px-4 py-3 dark:bg-surface-2-dark">
                        <Text
                            testID="intention-chat-message-text"
                            className="text-[17px] leading-relaxed text-user-text dark:text-user-text-dark"
                            style={{ color: messageTextColor }}
                        >
                            {displayContent}
                        </Text>
                    </View>
                </View>
            )}
        </Animated.View>
    );
}
