import React from 'react';
import { Text, View } from 'react-native';

type FreeModelBadgeProps = {
    readonly compact?: boolean;
};

export function FreeModelBadge({ compact = false }: FreeModelBadgeProps) {
    return (
        <View
            className={`rounded-md bg-accent-green/15 dark:bg-accent-green-dark/20 ${
                compact ? 'px-1.5 py-0.5' : 'px-2 py-0.5'
            }`}
            accessibilityLabel="Free model"
        >
            <Text
                className={`font-semibold uppercase tracking-wide text-accent-green dark:text-accent-green-dark ${
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
        <View className="rounded-full bg-accent-green/15 dark:bg-accent-green-dark/20 px-2 py-0.5">
            <Text className="text-[10px] font-semibold uppercase tracking-wide text-accent-green dark:text-accent-green-dark">
                Free only
            </Text>
        </View>
    );
}
