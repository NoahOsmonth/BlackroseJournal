import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { MemoryLayerColors } from '@/constants/theme';
import type { MemoryLayer } from '@/services/memory/memoryGraph.types';
import { MEMORY_LAYER_LABELS } from '@/components/memory/memoryDisplay';

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
            testID="memory-layer-filters"
            horizontal
            className="border-b border-divider-light dark:border-divider-dark"
            contentContainerStyle={{
                alignItems: 'center',
                gap: 10,
                minHeight: 64,
                paddingHorizontal: 20,
                paddingVertical: 12,
            }}
            showsHorizontalScrollIndicator={false}
        >
            {LAYERS.map((layer) => {
                const isActive = activeLayers.has(layer);
                const label = MEMORY_LAYER_LABELS[layer];
                const color = MemoryLayerColors[layer];

                return (
                    <Pressable
                        key={layer}
                        testID={`memory-layer-filter-${layer}`}
                        accessibilityLabel={`Toggle ${label} memories`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isActive }}
                        className={`min-h-10 flex-row items-center rounded-2xl border px-3.5 py-2.5 ${
                            isActive
                                ? 'border-transparent bg-surface-light dark:bg-surface-dark'
                                : 'border-divider-light bg-surface-light dark:border-divider-dark dark:bg-surface-dark'
                        }`}
                        style={
                            isActive
                                ? {
                                      borderColor: `${color}66`,
                                      backgroundColor: `${color}28`,
                                      shadowColor: color,
                                      shadowOffset: { width: 0, height: 4 },
                                      shadowOpacity: 0.28,
                                      shadowRadius: 10,
                                      elevation: 3,
                                  }
                                : undefined
                        }
                        onPress={() => onToggle(layer)}
                    >
                        <View
                            className="mr-2.5 h-2.5 w-2.5 rounded-full"
                            style={{
                                backgroundColor: color,
                                opacity: isActive ? 1 : 0.55,
                                shadowColor: color,
                                shadowOffset: { width: 0, height: 0 },
                                shadowOpacity: isActive ? 0.9 : 0,
                                shadowRadius: 6,
                            }}
                        />
                        <Text
                            numberOfLines={1}
                            className={`text-xs font-semibold tracking-wide ${
                                isActive
                                    ? 'text-text-light dark:text-white'
                                    : 'text-text-secondary-light dark:text-text-secondary-dark'
                            }`}
                            style={{ lineHeight: 16 }}
                        >
                            {label}
                        </Text>
                    </Pressable>
                );
            })}
        </ScrollView>
    );
}
