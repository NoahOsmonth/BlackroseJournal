import React from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { getIntentionAreaConfig } from '@/constants/intentions';
import { Intention } from '@/services/intentions/intentionsStorage.types';

interface IntentionCardProps {
    intention: Intention;
    onPress?: () => void;
}

export function IntentionCard({ intention, onPress }: IntentionCardProps) {
    const config = getIntentionAreaConfig(intention.area);
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
                {config?.icon ? <MaterialIcons name={config.icon} size={18} color={iconColor} /> : null}
            </View>
            <Text className="font-medium text-sm leading-tight text-text-light dark:text-text-dark" numberOfLines={2}>
                {intention.title}
            </Text>
        </Pressable>
    );
}
