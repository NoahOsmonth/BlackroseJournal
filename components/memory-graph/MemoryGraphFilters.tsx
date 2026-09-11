import React from 'react';
import { Pressable, Text, View } from 'react-native';

import type { MemoryLayer } from '@/services/memory/memoryGraph.types';

interface FilterProps {
    activeLayers: Set<MemoryLayer>;
    onToggle: (layer: MemoryLayer) => void;
}

/** Concept shows exactly three chips: Episodic · Semantic · Profile. */
const LAYERS: MemoryLayer[] = ['episodic', 'semantic', 'profile'];

const LABELS: Record<string, string> = {
    episodic: 'Episodic',
    semantic: 'Semantic',
    profile: 'Profile',
};

/**
 * Layer filters as three centred outline pills — no family dots, no scrolling.
 * Matches black-rose-threads.png, where the chips sit as one quiet cluster.
 */
export function MemoryGraphFilters({ activeLayers, onToggle }: FilterProps) {
    return (
        <View
            testID="memory-layer-filters"
            className="min-h-14 flex-row items-center justify-center gap-2 px-5 py-3"
        >
            {LAYERS.map((layer) => {
                const isActive = activeLayers.has(layer);
                return (
                    <Pressable
                        key={layer}
                        testID={`memory-layer-filter-${layer}`}
                        accessibilityLabel={`Toggle ${LABELS[layer]} memories`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isActive }}
                        className={
                            isActive
                                ? 'min-h-8 items-center justify-center rounded-control border border-bone-light px-3.5 py-1.5 dark:border-bone-dark'
                                : 'min-h-8 items-center justify-center rounded-control border border-hairline-light px-3.5 py-1.5 dark:border-hairline-dark'
                        }
                        onPress={() => onToggle(layer)}
                    >
                        <Text
                            numberOfLines={1}
                            className={
                                isActive
                                    ? 'text-[13px] text-text-light dark:text-text-dark'
                                    : 'text-[13px] text-text-secondary-light dark:text-text-secondary-dark'
                            }
                            style={{ lineHeight: 16 }}
                        >
                            {LABELS[layer]}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}
