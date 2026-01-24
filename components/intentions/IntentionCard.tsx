import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { getIntentionAreaConfig } from '@/constants/intentions';
import { Intention } from '@/services/intentions/intentionsStorage.types';

interface IntentionCardProps {
    intention: Intention;
    onPress?: () => void;
}

export function IntentionCard({ intention, onPress }: IntentionCardProps) {
    const config = getIntentionAreaConfig(intention.area);
    const Icon = config?.icon;
    const iconColor = config?.color ?? '#F87171';
    const iconBg = `${iconColor}33`;

    return (
        <Pressable
            onPress={onPress}
            className="bg-surface-light dark:bg-surface-dark rounded-2xl p-5 flex flex-col justify-between h-32 border border-gray-100 dark:border-white/5 shadow-soft"
            accessibilityLabel={`Open intention ${intention.title}`}
        >
            <View
                className="w-8 h-8 rounded-full items-center justify-center mb-2"
                style={{ backgroundColor: iconBg }}
            >
                {Icon ? <Icon size={18} color={iconColor} weight="fill" /> : null}
            </View>
            <Text className="font-medium text-sm leading-tight text-text-light dark:text-white" numberOfLines={2}>
                {intention.title}
            </Text>
        </Pressable>
    );
}
