import React from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface SettingsAccordionSectionProps {
    readonly id: string;
    readonly title: string;
    readonly summary?: string;
    /** @deprecated the concept rows carry no icon chip — kept for callers. */
    readonly icon?: keyof typeof MaterialIcons.glyphMap;
    readonly expanded: boolean;
    readonly onToggle: (id: string) => void;
    readonly children: React.ReactNode;
}

/**
 * One Settings row: serif label on the left, its current value right-aligned in
 * serif, chevron at the far edge, all separated by full-bleed hairlines. The
 * concept shows no card and no icon chip — the list itself is the panel.
 */
export function SettingsAccordionSection({
    id,
    title,
    summary,
    expanded,
    onToggle,
    children,
}: SettingsAccordionSectionProps) {
    const isDark = useColorScheme() === 'dark';
    const chevronColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;

    return (
        <View>
            <Pressable
                onPress={() => onToggle(id)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel={`${title}${summary ? `, ${summary}` : ''}`}
                className="min-h-[64px] flex-row items-center gap-3 py-4 active:opacity-70"
            >
                <Text
                    className="shrink-0 text-[19px] text-text-light dark:text-text-dark"
                    style={{ fontFamily: 'PlayfairDisplayRegular' }}
                >
                    {title}
                </Text>

                {summary ? (
                    <Text
                        className="min-w-0 flex-1 text-right text-[15px] text-text-secondary-light dark:text-text-secondary-dark"
                        numberOfLines={1}
                        style={{ fontFamily: 'PlayfairDisplayRegular' }}
                    >
                        {summary}
                    </Text>
                ) : (
                    <View className="flex-1" />
                )}

                <MaterialIcons
                    name={expanded ? 'expand-less' : 'expand-more'}
                    size={22}
                    color={chevronColor}
                />
            </Pressable>

            {/* Hairline sits between rows and under the last one — the concept's
                list has a rule on both sides of every entry. */}
            <View className="h-px w-full bg-hairline-light dark:bg-hairline-dark" />

            {expanded ? (
                <View className="pt-4 pb-6">{children}</View>
            ) : null}
        </View>
    );
}
