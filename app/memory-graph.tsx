import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import { MemoryGraphScreen } from '@/components/memory-graph';
import { useNavBack } from '@/hooks/navigation/useNavBack';
import type { MemoryLayer } from '@/services/memory/memoryGraph.types';

const VALID_LAYERS = new Set<MemoryLayer>([
    'episodic',
    'semantic',
    'profile',
    'procedural',
    'note',
    'working',
]);

function firstParam(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

function layerParam(value: string | string[] | undefined): MemoryLayer | undefined {
    const layer = firstParam(value);
    return layer && VALID_LAYERS.has(layer as MemoryLayer)
        ? layer as MemoryLayer
        : undefined;
}

export default function MemoryGraphRoute() {
    const goBack = useNavBack('/(tabs)/explore');
    const params = useLocalSearchParams<{ layer?: string; tag?: string; q?: string }>();
    const initialQuery = firstParam(params.tag) ?? firstParam(params.q);

    return (
        <MemoryGraphScreen
            initialLayer={layerParam(params.layer)}
            initialQuery={initialQuery}
            onBack={goBack}
        />
    );
}
