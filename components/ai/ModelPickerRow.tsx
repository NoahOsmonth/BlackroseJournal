import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatContextWindow } from '@/services/ai/modelContext';
import type { CustomAiModel } from '@/services/ai/customModels';
import { formatPickerModelName, isFreeModelId } from '@/utils/ai/modelDisplay';
import { FreeModelBadge } from './FreeModelBadge';

type ModelPickerRowProps = {
    readonly model: CustomAiModel;
    readonly selected: boolean;
    readonly onPress: () => void;
};

export function ModelPickerRow({ model, selected, onPress }: ModelPickerRowProps) {
    const isDark = useColorScheme() === 'dark';
    const radioColor = selected
        ? (isDark ? '#F9FAFB' : '#111827')
        : (isDark ? '#9CA3AF' : '#6B7280');
    const free = isFreeModelId(model.id);
    const displayName = model.name ?? formatPickerModelName(model.id);

    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`Select ${displayName}`}
            className={`flex-row items-start gap-3 rounded-xl border px-3 py-3 active:opacity-80 ${
                selected
                    ? 'border-primary bg-primary/10 dark:bg-primary/20'
                    : 'border-divider-light dark:border-divider-dark bg-transparent'
            }`}
        >
            <Ionicons
                name={selected ? 'radio-button-on' : 'radio-button-off'}
                size={18}
                color={radioColor}
            />
            <View className="flex-1 min-w-0 gap-1">
                <View className="flex-row items-center gap-2">
                    <Text
                        numberOfLines={1}
                        className="flex-1 text-base font-semibold text-text-light dark:text-text-dark"
                    >
                        {displayName}
                    </Text>
                    {free ? <FreeModelBadge compact /> : null}
                    <Text className="text-xs text-subtext-light dark:text-subtext-dark shrink-0">
                        {formatContextWindow(model.contextWindow)}
                    </Text>
                </View>
                <Text
                    numberOfLines={1}
                    ellipsizeMode="middle"
                    className="text-xs text-subtext-light dark:text-subtext-dark"
                >
                    {model.id}
                </Text>
            </View>
        </Pressable>
    );
}
