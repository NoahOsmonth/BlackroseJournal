import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

interface IntentionChatHeaderProps {
    personaName: string;
    onOpenPersona: () => void;
    onOpenDrafts: () => void;
    onClose: () => void;
}

export function IntentionChatHeader({
    personaName,
    onOpenPersona,
    onOpenDrafts,
    onClose,
}: IntentionChatHeaderProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const badgeIconColor = isDark ? Colors.dark.text : Colors.light.surface;
    const chevronIconColor = isDark ? Colors.dark.tabIconDefault : Colors.light.tabIconDefault;
    const closeIconColor = isDark ? Colors.dark.text : Colors.light.text;

    return (
        <View className="flex-row items-center justify-between px-4 py-3 pt-6">
            <Pressable
                onPress={onOpenPersona}
                className="flex-row items-center space-x-2 bg-gray-100 dark:bg-card-dark border border-divider-light dark:border-divider-dark rounded-full pl-1 pr-3 py-1"
                accessibilityLabel="Choose persona"
            >
                <View
                    testID="intention-chat-persona-badge"
                    className="w-7 h-7 bg-persona-rose rounded-full items-center justify-center"
                >
                    <MaterialIcons name="spa" size={14} color={badgeIconColor} />
                </View>
                <Text className="text-sm font-medium text-text-light dark:text-gray-200">
                    {personaName}
                </Text>
                <MaterialIcons name="expand-more" size={18} color={chevronIconColor} />
            </Pressable>
            <View className="flex-row items-center space-x-4">
                <Pressable onPress={onOpenDrafts} accessibilityLabel="Open drafts">
                    <Text className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
                        Drafts
                    </Text>
                </Pressable>
                <Pressable onPress={onClose} accessibilityLabel="Close">
                    <MaterialIcons name="close" size={24} color={closeIconColor} />
                </Pressable>
            </View>
        </View>
    );
}
