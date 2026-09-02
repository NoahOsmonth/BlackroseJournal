import React from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, Text } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useActiveModelContext } from '@/hooks/settings/useActiveModelContext';
import { formatContextWindow, formatModelName } from '@/services/ai/modelContext';
import { isFreeModelId } from '@/utils/ai/modelDisplay';
import { FreeModelBadge } from './FreeModelBadge';

type ModelHeaderControlProps = {
    readonly onPress?: () => void;
    readonly disabled?: boolean;
};

export function ModelHeaderControl({ onPress, disabled = false }: ModelHeaderControlProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const { context, isLoading } = useActiveModelContext();
    const chevronColor = isDark ? Colors.dark.tabIconDefault : Colors.light.tabIconDefault;
    const interactive = Boolean(onPress) && !disabled;

    let label: string;
    let free = false;
    if (isLoading && !context) {
        label = 'Detecting model…';
    } else if (context) {
        free = isFreeModelId(context.model);
        label = `${formatModelName(context.model)} · ${formatContextWindow(context.contextWindow)}`;
    } else {
        label = 'Choose model';
    }

    return (
        <Pressable
            onPress={onPress}
            disabled={!interactive}
            accessibilityRole={interactive ? 'button' : undefined}
            accessibilityState={{ disabled: !interactive }}
            accessibilityLabel={
                interactive
                    ? `Model: ${label}. Tap to change.`
                    : `Model: ${label}`
            }
            className={`mt-2 self-start max-w-full flex-row items-center gap-1.5 rounded-full border border-divider-light dark:border-divider-dark bg-gray-100 dark:bg-card-dark pl-2 pr-2.5 py-1.5 active:opacity-80 ${
                disabled ? 'opacity-50' : ''
            }`}
        >
            {free ? <FreeModelBadge compact /> : null}
            <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                className="flex-shrink text-[11px] font-medium text-text-secondary-light dark:text-text-secondary-dark"
            >
                {label}
            </Text>
            {interactive ? (
                <MaterialIcons name="expand-more" size={16} color={chevronColor} />
            ) : null}
        </Pressable>
    );
}
