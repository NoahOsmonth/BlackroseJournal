import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { useColorScheme } from '@/hooks/use-color-scheme';

interface SettingsAccordionSectionProps {
    readonly id: string;
    readonly title: string;
    readonly summary?: string;
    readonly icon: keyof typeof MaterialIcons.glyphMap;
    readonly expanded: boolean;
    readonly onToggle: (id: string) => void;
    readonly children: React.ReactNode;
}

export function SettingsAccordionSection({
    id,
    title,
    summary,
    icon,
    expanded,
    onToggle,
    children,
}: SettingsAccordionSectionProps) {
    const isDark = useColorScheme() === 'dark';
    const iconColor = isDark ? '#F9FAFB' : '#111827';
    const mutedIconColor = isDark ? '#9CA3AF' : '#6B7280';

    return (
        <View className="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-sm mb-3 overflow-hidden">
            <Pressable
                onPress={() => onToggle(id)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel={`${title}${summary ? `, ${summary}` : ''}`}
                className="flex-row items-center gap-3 px-4 py-4 min-h-[56px] active:opacity-80"
            >
                <View className="w-9 h-9 rounded-xl bg-background-light dark:bg-secondary-dark items-center justify-center">
                    <MaterialIcons name={icon} size={20} color={iconColor} />
                </View>

                <View className="flex-1 min-w-0">
                    <Text className="text-[16px] font-semibold text-text-light dark:text-text-dark">
                        {title}
                    </Text>
                    {summary ? (
                        <Text
                            className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark mt-0.5"
                            numberOfLines={1}
                        >
                            {summary}
                        </Text>
                    ) : null}
                </View>

                <MaterialIcons
                    name={expanded ? 'expand-less' : 'expand-more'}
                    size={24}
                    color={mutedIconColor}
                />
            </Pressable>

            {expanded ? (
                <View className="border-t border-divider-light dark:border-divider-dark px-4 pt-4 pb-5">
                    {children}
                </View>
            ) : null}
        </View>
    );
}
