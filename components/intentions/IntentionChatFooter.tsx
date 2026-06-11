import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface IntentionChatFooterProps {
    isMuted: boolean;
    onToggleMuted: () => void;
    onFinish: () => void;
    onSuggest: () => void;
}

export function IntentionChatFooter({
    isMuted,
    onToggleMuted,
    onFinish,
    onSuggest,
}: IntentionChatFooterProps) {
    const isDark = useColorScheme() === 'dark';
    const mutedIconColor = isDark ? Colors.dark.tabIconDefault : Colors.light.tabIconDefault;
    const activeIconColor = isDark ? Colors.dark.primary : Colors.light.primary;

    return (
        <View className="px-4 pb-6 bg-background-light dark:bg-background-dark">
            <View className="items-center mb-6">
                <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                    Note: Rosebud can make mistakes
                </Text>
            </View>
            <View className="flex-row items-center justify-between mb-4 px-1">
                <View />
                <Pressable accessibilityLabel="Toggle volume" onPress={onToggleMuted}>
                    <MaterialIcons
                        name={isMuted ? 'volume-off' : 'volume-up'}
                        size={24}
                        color={isMuted ? mutedIconColor : activeIconColor}
                    />
                </Pressable>
            </View>
            <View className="flex-row gap-3 h-14">
                <Pressable
                    onPress={onFinish}
                    className="flex-1 rounded-2xl border border-divider-light dark:border-divider-dark items-center justify-center"
                >
                    <Text className="text-[15px] font-medium text-text-light dark:text-gray-200">
                        Finish entry
                    </Text>
                </Pressable>
                <Pressable
                    onPress={onSuggest}
                    className="flex-1 rounded-2xl border border-divider-light dark:border-divider-dark items-center justify-center flex-row gap-2"
                >
                    <MaterialIcons name="auto-awesome" size={18} color={mutedIconColor} />
                    <Text className="text-[15px] font-medium text-text-light dark:text-gray-200">
                        Suggest
                    </Text>
                </Pressable>
            </View>
        </View>
    );
}
