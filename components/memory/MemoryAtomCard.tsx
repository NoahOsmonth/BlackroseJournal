import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { MemoryLayerColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { LocalMemoryAtom } from '@/services/memory/localMemory.types';
import { formatMemoryScore, MEMORY_LAYER_LABELS } from './memoryDisplay';

interface MemoryAtomCardProps {
    atom: LocalMemoryAtom;
    onDelete: (atom: LocalMemoryAtom) => void;
    onTagPress: (tag: string) => void;
}

function ScoreBadge({ label, value }: { readonly label: string; readonly value: number }) {
    return (
        <View className="rounded-full bg-background-light px-2 py-1 dark:bg-background-dark">
            <Text className="text-[10px] font-bold uppercase text-text-secondary-light dark:text-text-secondary-dark">
                {label} {formatMemoryScore(value)}
            </Text>
        </View>
    );
}

export function MemoryAtomCard({ atom, onDelete, onTagPress }: MemoryAtomCardProps) {
    const isDark = useColorScheme() === 'dark';
    const dangerColor = isDark ? '#F87171' : '#DC2626';
    const layerColor = MemoryLayerColors[atom.layer];
    const tags = atom.tags.slice(0, 4);

    return (
        <View className="rounded-lg border border-divider-light bg-surface-light p-4 dark:border-divider-dark dark:bg-surface-dark">
            <View className="mb-3 flex-row items-start gap-3">
                <View
                    className="mt-1 h-3 w-3 rounded-full"
                    style={{ backgroundColor: layerColor }}
                    accessibilityLabel={`${MEMORY_LAYER_LABELS[atom.layer]} memory marker`}
                />
                <View className="flex-1">
                    <View className="mb-1 flex-row items-center gap-2">
                        <Text className="text-[10px] font-bold uppercase text-text-secondary-light dark:text-text-secondary-dark">
                            {MEMORY_LAYER_LABELS[atom.layer]}
                        </Text>
                        <Text className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark">
                            {atom.source}
                        </Text>
                    </View>
                    <Text className="text-base font-bold text-text-light dark:text-text-dark">
                        {atom.title}
                    </Text>
                </View>
                <Pressable
                    onPress={() => onDelete(atom)}
                    className="h-9 w-9 items-center justify-center rounded-full"
                    accessibilityRole="button"
                    accessibilityLabel={`Delete memory ${atom.title}`}
                >
                    <MaterialIcons name="delete-outline" size={20} color={dangerColor} />
                </Pressable>
            </View>

            <Text className="text-sm leading-5 text-text-light dark:text-text-dark">
                {atom.content}
            </Text>

            <View className="mt-3 flex-row flex-wrap gap-2">
                <ScoreBadge label="salience" value={atom.salience} />
                <ScoreBadge label="confidence" value={atom.confidence} />
            </View>

            {tags.length > 0 ? (
                <View className="mt-3 flex-row flex-wrap gap-2">
                    {tags.map((tag) => (
                        <Pressable
                            key={tag}
                            onPress={() => onTagPress(tag)}
                            className="rounded-full border border-divider-light px-2.5 py-1 dark:border-divider-dark"
                            accessibilityRole="button"
                            accessibilityLabel={`Filter memory by ${tag}`}
                        >
                            <Text className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                                #{tag}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            ) : null}
        </View>
    );
}
