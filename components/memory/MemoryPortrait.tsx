import React from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { useColorScheme } from '@/hooks/use-color-scheme';
import type { LocalMemoryAtom } from '@/services/memory/localMemory.types';
import {
    memoryPortraitProse,
    profilePreview,
    topMemoryThemes,
} from './memoryDisplay';

interface MemoryPortraitProps {
    atoms: readonly LocalMemoryAtom[];
    onOpenGraph: () => void;
    onThemePress: (tag: string) => void;
}

export function MemoryPortrait({
    atoms,
    onOpenGraph,
    onThemePress,
}: MemoryPortraitProps) {
    const isDark = useColorScheme() === 'dark';
    const chevron = isDark ? '#F9FAFB' : '#6B7280';
    const about = profilePreview(atoms);
    const themes = topMemoryThemes(atoms, 6);
    const prose = memoryPortraitProse(atoms);

    return (
        <View className="gap-5">
            <View>
                <Text className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                    About you
                </Text>
                {about ? (
                    <Text
                        className="mt-2 text-[15px] leading-6 text-text-light dark:text-text-dark"
                        numberOfLines={5}
                    >
                        {about}
                    </Text>
                ) : (
                    <Text className="mt-2 text-sm leading-relaxed text-text-secondary-light dark:text-text-secondary-dark">
                        As you finish journal entries, Rosebud builds a private portrait of what matters.
                    </Text>
                )}
                <Text className="mt-3 text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
                    {prose}
                </Text>
            </View>

            {themes.length > 0 ? (
                <View className="flex-row flex-wrap gap-2">
                    {themes.map((theme) => (
                        <Pressable
                            key={theme}
                            onPress={() => onThemePress(theme)}
                            className="rounded-full border border-divider-light dark:border-divider-dark bg-surface-light dark:bg-surface-dark px-3 py-1.5"
                            accessibilityRole="button"
                            accessibilityLabel={`Filter memory by ${theme}`}
                        >
                            <Text className="text-xs font-semibold text-text-light dark:text-text-dark">
                                {theme}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            ) : null}

            <Pressable
                onPress={onOpenGraph}
                className="flex-row items-center gap-3 overflow-hidden rounded-2xl border border-divider-light bg-surface-light px-4 py-4 dark:border-white/10 dark:bg-black"
                accessibilityRole="button"
                accessibilityLabel="Explore memory graph"
                style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
            >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/20">
                    <MaterialIcons name="hub" size={20} color={isDark ? '#FFB340' : '#FF9F0A'} />
                </View>
                <View className="flex-1">
                    <Text className="text-sm font-semibold text-text-light dark:text-white">
                        Open the map
                    </Text>
                    <Text className="mt-0.5 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                        See how memories connect
                    </Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={chevron} />
            </Pressable>
        </View>
    );
}
