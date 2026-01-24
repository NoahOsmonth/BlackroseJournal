import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { Message } from '@/services/ai/ai';

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
    const isAssistant = message.role === 'assistant';

    return (
        <View className="space-y-2">
            <Text
                className={`text-[17px] leading-relaxed ${isAssistant
                    ? 'text-accent-blue dark:text-ai-text'
                    : 'text-text-secondary-light dark:text-text-secondary-dark'
                    }`}
            >
                {message.content}
            </Text>
            {isAssistant && (
                <View className="flex-row items-center space-x-5">
                    <Pressable onPress={() => onPlay(message.content)} accessibilityLabel="Play message">
                        <MaterialIcons name="play-arrow" size={22} color="#4A90E2" />
                    </Pressable>
                    <Pressable onPress={() => onCopy(message.content)} accessibilityLabel="Copy message">
                        <MaterialIcons name="content-copy" size={20} color="#4A90E2" />
                    </Pressable>
                    <Pressable onPress={() => onThumb(message.id, 'up')} accessibilityLabel="Thumbs up">
                        <MaterialIcons
                            name="thumb-up"
                            size={20}
                            color={feedback === 'up' ? '#60A5FA' : '#4A90E2'}
                        />
                    </Pressable>
                    <Pressable onPress={() => onThumb(message.id, 'down')} accessibilityLabel="Thumbs down">
                        <MaterialIcons
                            name="thumb-down"
                            size={20}
                            color={feedback === 'down' ? '#60A5FA' : '#4A90E2'}
                        />
                    </Pressable>
                    <Pressable onPress={() => onShare(message.content)} accessibilityLabel="Share message">
                        <MaterialIcons name="ios-share" size={20} color="#4A90E2" />
                    </Pressable>
                </View>
            )}
        </View>
    );
}
