import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { useColorScheme } from '@/hooks/use-color-scheme';

interface IntentionActionCardProps {
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    onPress?: () => void;
    isCompleted?: boolean;
}

export function IntentionActionCard({
    title,
    subtitle,
    icon,
    onPress,
    isCompleted = false,
}: IntentionActionCardProps) {
    const accessibility = title.replace('\n', ' ');
    const isDark = useColorScheme() === 'dark';
    const checkColor = isDark ? '#9CA3AF' : '#6B7280';

    return (
        <Pressable
            onPress={onPress}
            className="bg-surface-light dark:bg-surface-dark rounded-[20px] p-5 min-h-[148px] flex-1 border border-gray-100 dark:border-white/5 shadow-soft justify-between items-center"
            accessibilityLabel={accessibility}
        >
            <View className="items-center gap-3 w-full">
                <View>{icon}</View>
                <Text className="text-[15px] font-semibold leading-tight text-center text-text-light dark:text-text-dark">
                    {title}
                </Text>
            </View>

            {/* Reserved footer slot — same height for completed vs pending */}
            <View className="h-7 mt-3 items-center justify-center">
                {isCompleted ? (
                    <View className="flex-row items-center gap-1.5">
                        <MaterialIcons name="check-circle" size={16} color={checkColor} />
                        <Text className="text-[11px] font-medium text-text-secondary-light dark:text-text-secondary-dark">
                            Done
                        </Text>
                    </View>
                ) : (
                    <Text className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark font-medium">
                        {subtitle}
                    </Text>
                )}
            </View>
        </Pressable>
    );
}
