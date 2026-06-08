import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { MemoryLayerColors } from '@/constants/theme';
import type { MemoryLayer } from '@/services/memory/memoryGraph.types';

interface FilterProps {
    activeLayers: Set<MemoryLayer>;
    onToggle: (layer: MemoryLayer) => void;
}

const LAYERS: MemoryLayer[] = [
    'episodic',
    'semantic',
    'profile',
    'procedural',
    'note',
    'working',
];

export function MemoryGraphFilters({ activeLayers, onToggle }: FilterProps) {
    return (
        <ScrollView
            horizontal
            className="max-h-14 border-b border-divider-light dark:border-divider-dark"
            contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingVertical: 12 }}
            showsHorizontalScrollIndicator={false}
        >
            {LAYERS.map((layer) => {
                const isActive = activeLayers.has(layer);

                return (
                    <Pressable
                        key={layer}
                        accessibilityLabel={`Toggle ${layer} memories`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isActive }}
                        className={`flex-row items-center rounded-full border px-3 py-2 ${
                            isActive
                                ? 'border-divider-dark bg-background-dark dark:bg-surface-dark'
                                : 'border-divider-light dark:border-divider-dark'
                        }`}
                        onPress={() => onToggle(layer)}
                    >
                        <View
                            className="mr-2 h-2 w-2 rounded-full"
                            style={{ backgroundColor: MemoryLayerColors[layer] }}
                        />
                        <Text
                            className={`text-xs font-semibold capitalize ${
                                isActive
                                    ? 'text-text-dark dark:text-text-dark'
                                    : 'text-text-secondary-light dark:text-text-secondary-dark'
                            }`}
                        >
                            {layer}
                        </Text>
                    </Pressable>
                );
            })}
        </ScrollView>
    );
}
