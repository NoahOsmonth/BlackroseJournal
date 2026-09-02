import React from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { IntentionArea } from '@/services/intentions/intentionsStorage.types';
import { getIntentionAreaConfig } from '@/constants/intentions';

interface IntentionAreaButtonProps {
    area: IntentionArea;
    onPress: (area: IntentionArea) => void;
}

export function IntentionAreaButton({ area, onPress }: IntentionAreaButtonProps) {
    const config = getIntentionAreaConfig(area);
    const color = config?.color ?? '#F472B6';

    return (
        <Pressable
            onPress={() => onPress(area)}
            className="w-full flex-row items-center justify-between p-4 bg-surface-light dark:bg-card-dark rounded-2xl shadow-soft border border-gray-100 dark:border-white/5"
            accessibilityLabel={`Choose ${config?.label ?? area}`}
        >
            <View className="flex-row items-center gap-4">
                <View className="w-8 items-center justify-center">
                    {config?.icon ? <MaterialIcons name={config.icon} size={28} color={color} /> : null}
                </View>
                <Text className="text-[17px] font-medium text-text-light dark:text-text-dark">
                    {config?.label ?? area}
                </Text>
            </View>
            <MaterialIcons name="chevron-right" size={18} color="#9CA3AF" />
        </Pressable>
    );
}
