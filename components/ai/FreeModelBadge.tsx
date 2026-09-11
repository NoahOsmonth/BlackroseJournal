import React from 'react';
import { Text, View } from 'react-native';

type FreeModelBadgeProps = {
    readonly compact?: boolean;
};

export function FreeModelBadge({ compact = false }: FreeModelBadgeProps) {
    return (
        <View
            className={`rounded-control border border-hairline-light dark:border-hairline-dark ${
                compact ? 'px-1.5 py-0.5' : 'px-2 py-0.5'
            }`}
            accessibilityLabel="Free model"
        >
            <Text
                className={`uppercase tracking-[1.2px] text-text-secondary-light dark:text-text-secondary-dark ${
                    compact ? 'text-[10px]' : 'text-[10px]'
                }`}
            >
                Free
            </Text>
        </View>
    );
}

export function FreeOnlyPill() {
    return (
        <View className="rounded-control border border-hairline-light px-2 py-0.5 dark:border-hairline-dark">
            <Text className="text-[10px] uppercase tracking-[1.2px] text-text-secondary-light dark:text-text-secondary-dark">
                Free only
            </Text>
        </View>
    );
}
