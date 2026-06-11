import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { LocalMemoryAtom } from '@/services/memory/localMemory.types';
import {
    countLayer,
    profilePreview,
    topMemoryThemes,
} from './memoryDisplay';

interface MemoryHubSummaryProps {
    atoms: readonly LocalMemoryAtom[];
    onOpenGraph: () => void;
    onThemePress: (tag: string) => void;
}

function SummaryMetric({ label, value }: { readonly label: string; readonly value: number }) {
    return (
        <View className="flex-1 rounded-lg border border-divider-light bg-surface-light p-3 dark:border-divider-dark dark:bg-surface-dark">
            <Text className="text-xl font-bold text-text-light dark:text-text-dark">
                {value}
            </Text>
            <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                {label}
            </Text>
        </View>
    );
}

export function MemoryHubSummary({
    atoms,
    onOpenGraph,
    onThemePress,
}: MemoryHubSummaryProps) {
    const isDark = useColorScheme() === 'dark';
    const iconColor = isDark ? Colors.dark.primary : Colors.light.primary;
    const neutralIconColor = isDark ? Colors.dark.text : Colors.light.text;
    const themes = topMemoryThemes(atoms);

    return (
        <View className="gap-4">
            <View className="flex-row gap-3">
                <SummaryMetric label="Total" value={atoms.length} />
                <SummaryMetric label="About me" value={countLayer(atoms, 'profile')} />
                <SummaryMetric label="Notes" value={countLayer(atoms, 'note')} />
            </View>

            <View className="rounded-lg border border-divider-light bg-surface-light p-4 dark:border-divider-dark dark:bg-surface-dark">
                <View className="mb-2 flex-row items-center gap-2">
                    <MaterialIcons name="person-search" size={18} color={iconColor} />
                    <Text className="text-xs font-bold uppercase text-text-secondary-light dark:text-text-secondary-dark">
                        About me
                    </Text>
                </View>
                <Text className="text-sm leading-5 text-text-light dark:text-text-dark">
                    {profilePreview(atoms)}
                </Text>
            </View>

            <View className="rounded-lg border border-divider-light bg-surface-light p-4 dark:border-divider-dark dark:bg-surface-dark">
                <Text className="mb-3 text-xs font-bold uppercase text-text-secondary-light dark:text-text-secondary-dark">
                    Recurring themes
                </Text>
                {themes.length > 0 ? (
                    <View className="flex-row flex-wrap gap-2">
                        {themes.map((theme) => (
                            <Pressable
                                key={theme}
                                onPress={() => onThemePress(theme)}
                                className="rounded-full bg-background-light px-3 py-2 dark:bg-background-dark"
                                accessibilityRole="button"
                                accessibilityLabel={`Filter memory by ${theme}`}
                            >
                                <Text className="text-xs font-bold text-text-light dark:text-text-dark">
                                    {theme}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                ) : (
                    <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                        Themes appear after completed journal entries create local memory.
                    </Text>
                )}
            </View>

            <Pressable
                onPress={onOpenGraph}
                className="flex-row items-center gap-3 rounded-lg border border-divider-light bg-surface-light p-4 dark:border-divider-dark dark:bg-surface-dark"
                accessibilityRole="button"
                accessibilityLabel="Explore memory graph"
            >
                <View className="rounded-full bg-primary/10 p-3 dark:bg-primary-dark/20">
                    <MaterialIcons name="hub" size={22} color={iconColor} />
                </View>
                <View className="flex-1">
                    <Text className="text-sm font-bold text-text-light dark:text-text-dark">
                        Explore graph
                    </Text>
                    <Text className="mt-1 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                        Open the relationship map for saved memories.
                    </Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={neutralIconColor} />
            </Pressable>
        </View>
    );
}
