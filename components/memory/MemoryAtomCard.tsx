import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';

import { MemoryLayerColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { LocalMemoryAtom } from '@/services/memory/localMemory.types';
import {
    formatRelativeMemoryTime,
    MEMORY_LAYER_LABELS,
    memoryAtomRoute,
} from './memoryDisplay';

interface MemoryAtomCardProps {
    atom: LocalMemoryAtom;
    onDelete: (atom: LocalMemoryAtom) => void;
    onTagPress: (tag: string) => void;
    onOpen?: (atom: LocalMemoryAtom) => void;
    isLast?: boolean;
}

export function MemoryAtomCard({
    atom,
    onDelete,
    onTagPress,
    onOpen,
    isLast = false,
}: MemoryAtomCardProps) {
    const isDark = useColorScheme() === 'dark';
    const dangerColor = isDark ? '#F87171' : '#DC2626';
    const layerColor = MemoryLayerColors[atom.layer];
    const tags = atom.tags.slice(0, 3);
    const route = memoryAtomRoute(atom);
    const canOpen = Boolean(route && onOpen);
    const relative = formatRelativeMemoryTime(atom.updatedAt || atom.createdAt);

    const handlePress = () => {
        if (!canOpen || !onOpen) return;
        if (Platform.OS !== 'web') {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onOpen(atom);
    };

    return (
        <Pressable
            onPress={canOpen ? handlePress : undefined}
            disabled={!canOpen}
            accessibilityRole={canOpen ? 'button' : undefined}
            accessibilityLabel={canOpen ? `Open memory ${atom.title}` : atom.title}
            className={`px-4 py-3.5 ${
                isLast ? '' : 'border-b border-divider-light dark:border-divider-dark'
            }`}
            style={({ pressed }) => [
                { opacity: pressed && canOpen ? 0.92 : 1 },
            ]}
        >
            <View className="flex-row items-start gap-3">
                <View
                    className="mt-1.5 h-2 w-2 rounded-full"
                    style={{ backgroundColor: layerColor }}
                    accessibilityLabel={`${MEMORY_LAYER_LABELS[atom.layer]} memory marker`}
                />
                <View className="min-w-0 flex-1">
                    <View className="flex-row items-center justify-between gap-2">
                        <Text className="text-[12px] font-medium text-text-secondary-light dark:text-text-secondary-dark">
                            {MEMORY_LAYER_LABELS[atom.layer]} · {relative}
                        </Text>
                        <Pressable
                            onPress={() => onDelete(atom)}
                            className="h-8 w-8 items-center justify-center rounded-full"
                            accessibilityRole="button"
                            accessibilityLabel={`Delete memory ${atom.title}`}
                            hitSlop={6}
                        >
                            <MaterialIcons name="delete-outline" size={18} color={dangerColor} />
                        </Pressable>
                    </View>
                    <Text
                        className="mt-0.5 text-[15px] font-semibold text-text-light dark:text-text-dark"
                        numberOfLines={2}
                    >
                        {atom.title}
                    </Text>
                    <Text
                        className="mt-1 text-sm leading-5 text-text-secondary-light dark:text-text-secondary-dark"
                        numberOfLines={2}
                    >
                        {atom.content}
                    </Text>
                    {tags.length > 0 ? (
                        <View className="mt-2 flex-row flex-wrap gap-1.5">
                            {tags.map((tag) => (
                                <Pressable
                                    key={tag}
                                    onPress={() => onTagPress(tag)}
                                    className="rounded-full bg-background-light dark:bg-background-dark px-2 py-0.5"
                                    accessibilityRole="button"
                                    accessibilityLabel={`Filter memory by ${tag}`}
                                >
                                    <Text className="text-[11px] font-medium text-text-secondary-light dark:text-text-secondary-dark">
                                        #{tag}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    ) : null}
                </View>
            </View>
        </Pressable>
    );
}
