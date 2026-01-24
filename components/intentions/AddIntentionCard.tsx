import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface AddIntentionCardProps {
    onPress?: () => void;
    variant?: 'compact' | 'full';
}

export function AddIntentionCard({ onPress, variant = 'compact' }: AddIntentionCardProps) {
    if (variant === 'full') {
        return (
            <Pressable
                onPress={onPress}
                className="w-full h-[72px] rounded-2xl border-2 border-dashed border-divider-light dark:border-divider-dark flex-row items-center justify-center gap-2.5"
                accessibilityLabel="Add intention"
            >
                <View className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 items-center justify-center">
                    <MaterialIcons name="add" size={20} color="#6B7280" />
                </View>
                <Text className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
                    Set an intention
                </Text>
            </Pressable>
        );
    }

    return (
        <Pressable
            onPress={onPress}
            className="rounded-2xl p-5 h-32 border-2 border-dashed border-divider-light dark:border-divider-dark items-center justify-center"
            accessibilityLabel="Add intention"
        >
            <View className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 items-center justify-center">
                <MaterialIcons name="add" size={20} color="#6B7280" />
            </View>
            <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-2">
                Set an intention
            </Text>
        </Pressable>
    );
}
