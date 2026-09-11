import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';

import { BLACKROSE_PALETTE, MemoryLayerColors } from '@/constants/theme';
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
    /** Retained for callers that render atoms as a single bordered list. */
    isLast?: boolean;
}

export function MemoryAtomCard({
    atom,
    onDelete,
    onTagPress,
    onOpen,
}: MemoryAtomCardProps) {
    const isDark = useColorScheme() === 'dark';
    const inkColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;
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
            className="gap-2 rounded-card border border-hairline-light bg-surface-light px-4 py-4 dark:border-hairline-dark dark:bg-surface-dark"
            style={({ pressed }) => [
                { opacity: pressed && canOpen ? 0.92 : 1 },
            ]}
        >
            <View className="flex-row items-start justify-between gap-3">
                <Text
                    className="min-w-0 flex-1 text-[19px] leading-7 text-text-light dark:text-text-dark"
                    style={{ fontFamily: 'PlayfairDisplayRegular' }}
                    numberOfLines={2}
                >
                    {atom.title}
                </Text>
                <Pressable
                    onPress={() => onDelete(atom)}
                    className="h-8 w-8 items-center justify-center"
                    accessibilityRole="button"
                    accessibilityLabel={`Delete memory ${atom.title}`}
                    hitSlop={6}
                >
                    <MaterialIcons name="more-vert" size={18} color={inkColor} />
                </Pressable>
            </View>

            <Text
                className="text-sm leading-5 text-text-secondary-light dark:text-text-secondary-dark"
                numberOfLines={2}
            >
                {atom.content}
            </Text>

            <View className="mt-1 flex-row items-center gap-2">
                <View
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: layerColor }}
                    accessibilityLabel={`${MEMORY_LAYER_LABELS[atom.layer]} memory marker`}
                />
                <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                    {MEMORY_LAYER_LABELS[atom.layer]} · {relative}
                </Text>
            </View>

            {tags.length > 0 ? (
                <View className="flex-row flex-wrap gap-3">
                    {tags.map((tag) => (
                        <Pressable
                            key={tag}
                            onPress={() => onTagPress(tag)}
                            accessibilityRole="button"
                            accessibilityLabel={`Filter memory by ${tag}`}
                            hitSlop={4}
                        >
                            <Text className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                                #{tag}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            ) : null}
        </Pressable>
    );
}
