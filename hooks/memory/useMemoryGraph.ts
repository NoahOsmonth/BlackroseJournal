import { useCallback, useMemo, useState } from 'react';
import { useLocalMemories } from './useLocalMemories';
import { synthesizeMemoryInsight } from '@/services/memory/memoryInsightService';
import {
    computeConnections,
    filterAtomsByLayer,
} from '@/services/memory/memoryGraphUtils';
import type { LocalMemoryAtom as StoredMemoryAtom } from '@/services/memory/localMemory.types';
import type {
    LocalMemoryAtom,
    MemoryLayer,
} from '@/services/memory/memoryGraph.types';

const ALL_LAYERS: MemoryLayer[] = [
    'episodic',
    'semantic',
    'profile',
    'procedural',
    'note',
    'working',
];

function toGraphAtom(atom: StoredMemoryAtom): LocalMemoryAtom {
    return {
        id: atom.id,
        entryId: atom.sourceId ?? atom.id,
        title: atom.title,
        content: atom.content,
        layer: atom.layer,
        salience: Math.max(1, Math.round(atom.salience * 10)),
        confidence: atom.confidence,
        tags: atom.tags,
        createdAt: new Date(atom.createdAt).toISOString(),
    };
}

function matchesQuery(atom: LocalMemoryAtom, query: string): boolean {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;
    const haystack = `${atom.title} ${atom.content} ${atom.tags.join(' ')}`.toLowerCase();
    return haystack.includes(normalized);
}

export function useMemoryGraph() {
    const { atoms: storedAtoms, isLoading, refresh } = useLocalMemories();
    const [activeLayers, setActiveLayers] = useState<Set<MemoryLayer>>(
        () => new Set(ALL_LAYERS)
    );
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [insight, setInsight] = useState<string | null>(null);
    const [isSynthesizing, setIsSynthesizing] = useState(false);

    const toggleLayer = useCallback((layer: MemoryLayer) => {
        setActiveLayers((current) => {
            const next = new Set(current);
            if (next.has(layer)) {
                next.delete(layer);
            } else {
                next.add(layer);
            }
            return next;
        });
    }, []);

    const atoms = useMemo(() => {
        const graphAtoms = storedAtoms.map(toGraphAtom);
        return filterAtomsByLayer(graphAtoms, activeLayers)
            .filter((atom) => matchesQuery(atom, searchQuery));
    }, [activeLayers, searchQuery, storedAtoms]);

    const connections = useMemo(() => computeConnections(atoms), [atoms]);

    const selectedAtom = useMemo(
        () => atoms.find((atom) => atom.id === selectedNodeId) ?? null,
        [atoms, selectedNodeId]
    );

    const closeSelectedAtom = useCallback(() => {
        setSelectedNodeId(null);
        setInsight(null);
    }, []);

    const synthesizeSelectedAtom = useCallback(async () => {
        if (!selectedAtom) return;
        setIsSynthesizing(true);
        try {
            setInsight(await synthesizeMemoryInsight(selectedAtom));
        } catch {
            setInsight('Execution failure generating contextual insights.');
        } finally {
            setIsSynthesizing(false);
        }
    }, [selectedAtom]);

    return {
        atoms,
        connections,
        activeLayers,
        toggleLayer,
        selectedAtom,
        setSelectedNodeId,
        closeSelectedAtom,
        searchQuery,
        setSearchQuery,
        isLoading,
        isSynthesizing,
        insight,
        refresh,
        synthesizeSelectedAtom,
    };
}
