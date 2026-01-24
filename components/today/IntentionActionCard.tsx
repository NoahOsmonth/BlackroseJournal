import React from 'react';
import { Image, ImageSourcePropType, Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface IntentionActionCardProps {
    title: string;
    subtitle: string;
    imageSource: ImageSourcePropType;
    onPress?: () => void;
    isCompleted?: boolean;
}

export function IntentionActionCard({
    title,
    subtitle,
    imageSource,
    onPress,
    isCompleted = false,
}: IntentionActionCardProps) {
    const accessibility = title.replace('\n', ' ');

    return (
        <Pressable
            onPress={onPress}
            className="bg-surface-light dark:bg-surface-dark rounded-[20px] p-5 flex flex-col items-center text-center shadow-soft border border-gray-100 dark:border-white/5"
            accessibilityLabel={accessibility}
        >
            <View className="mb-4">
                <Image source={imageSource} style={{ width: 48, height: 48 }} />
            </View>
            <Text className="text-[15px] font-semibold mb-0.5 leading-tight text-text-light dark:text-white">
                {title}
            </Text>
            {isCompleted ? (
                <View className="mt-3 w-8 h-8 rounded-full bg-text-secondary-light/20 dark:bg-text-secondary-dark/30 items-center justify-center">
                    <MaterialIcons name="check" size={18} color="#6B7280" />
                </View>
            ) : (
                <Text className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark font-medium">
                    {subtitle}
                </Text>
            )}
        </Pressable>
    );
}
