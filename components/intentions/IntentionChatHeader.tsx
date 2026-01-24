import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

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
    return (
        <View className="flex-row items-center justify-between px-4 py-3 pt-6">
            <Pressable
                onPress={onOpenPersona}
                className="flex-row items-center space-x-2 border border-divider-light dark:border-divider-dark rounded-full pl-1 pr-3 py-1"
                accessibilityLabel="Choose persona"
            >
                <View className="w-7 h-7 bg-primary rounded-full items-center justify-center">
                    <MaterialIcons name="spa" size={14} color="#FFFFFF" />
                </View>
                <Text className="text-sm font-medium text-text-light dark:text-gray-200">
                    {personaName}
                </Text>
                <MaterialIcons name="expand-more" size={18} color="#9CA3AF" />
            </Pressable>
            <View className="flex-row items-center space-x-4">
                <Pressable onPress={onOpenDrafts} accessibilityLabel="Open drafts">
                    <Text className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
                        Drafts
                    </Text>
                </Pressable>
                <Pressable onPress={onClose} accessibilityLabel="Close">
                    <MaterialIcons name="close" size={24} color="#9CA3AF" />
                </Pressable>
            </View>
        </View>
    );
}
