import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalMemories } from './useLocalMemories';
import { synthesizeMemoryInsight } from '@/services/memory/memoryInsightService';
import { relatedGraphAtoms } from '@/services/memory/localMemorySynthesis';
import {
    computeConnections,
    filterAtomsByLayer,
} from '@/services/memory/memoryGraphUtils';
import type { LocalMemoryAtom as StoredMemoryAtom } from '@/services/memory/localMemory.types';
import type {
    MemoryGraphAtom,
    MemoryLayer,
} from '@/services/memory/memoryGraph.types';

/** Working memory is chat-ephemeral; hide it from the graph by default. */
const DEFAULT_LAYERS: MemoryLayer[] = [
    'episodic',
    'semantic',
    'profile',
    'procedural',
    'note',
];

const ALL_LAYERS: MemoryLayer[] = [
    ...DEFAULT_LAYERS,
    'working',
];

export interface UseMemoryGraphOptions {
    initialLayer?: MemoryLayer;
    initialQuery?: string;
}

function toGraphAtom(atom: StoredMemoryAtom): MemoryGraphAtom {
    const rootId = atom.rootSourceId;
    return {
        id: atom.id,
        entryId: rootId ?? atom.sourceId ?? atom.id,
        source: atom.source,
        sourceId: atom.sourceId,
        rootSourceId: rootId,
        rootSourceKind: atom.rootSourceKind,
        title: atom.title,
        content: atom.content,
        layer: atom.layer,
        salience: Math.max(1, Math.round(atom.salience * 10)),
        confidence: atom.confidence,
        tags: atom.tags,
        createdAt: new Date(atom.createdAt).toISOString(),
    };
}

function matchesQuery(atom: MemoryGraphAtom, query: string): boolean {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;
    const haystack = `${atom.title} ${atom.content} ${atom.tags.join(' ')}`.toLowerCase();
    return haystack.includes(normalized);
}

function initialLayers(layer?: MemoryLayer): Set<MemoryLayer> {
    return layer && ALL_LAYERS.includes(layer)
        ? new Set([layer])
        : new Set(DEFAULT_LAYERS);
}

function softGlanceFallback(atom: MemoryGraphAtom): string {
    const text = atom.content.trim();
    if (!text) return atom.title;
    return text.length > 220 ? `${text.slice(0, 217).trim()}…` : text;
}

export function useMemoryGraph(options: UseMemoryGraphOptions = {}) {
    const { atoms: storedAtoms, isLoading, refresh } = useLocalMemories();
    const [activeLayers, setActiveLayers] = useState<Set<MemoryLayer>>(
        () => initialLayers(options.initialLayer)
    );
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState(options.initialQuery ?? '');
    const [glanceInsight, setGlanceInsight] = useState<string | null>(null);
    const [remoteInsight, setRemoteInsight] = useState<string | null>(null);
    const [isGlanceLoading, setIsGlanceLoading] = useState(false);
    const [isSynthesizing, setIsSynthesizing] = useState(false);
    const glanceCacheRef = useRef(new Map<string, string>());
    const glanceRequestIdRef = useRef(0);

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

    const relatedAtoms = useMemo(() => {
        if (!selectedAtom) return [];
        return relatedGraphAtoms(selectedAtom, atoms, connections, 3);
    }, [selectedAtom, atoms, connections]);

    // Auto AI "At a glance" whenever a node is selected (cached per atom id).
    useEffect(() => {
        if (!selectedAtom) {
            setGlanceInsight(null);
            setIsGlanceLoading(false);
            return;
        }

        const cached = glanceCacheRef.current.get(selectedAtom.id);
        if (cached) {
            setGlanceInsight(cached);
            setIsGlanceLoading(false);
            return;
        }

        const requestId = glanceRequestIdRef.current + 1;
        glanceRequestIdRef.current = requestId;
        setIsGlanceLoading(true);
        setGlanceInsight(null);

        const relatedTitles = relatedGraphAtoms(selectedAtom, atoms, connections, 3)
            .map((atom) => atom.title);

        void (async () => {
            try {
                const text = await synthesizeMemoryInsight(selectedAtom, {
                    mode: 'glance',
                    relatedTitles,
                });
                if (glanceRequestIdRef.current !== requestId) return;
                glanceCacheRef.current.set(selectedAtom.id, text);
                setGlanceInsight(text);
            } catch {
                if (glanceRequestIdRef.current !== requestId) return;
                const fallback = softGlanceFallback(selectedAtom);
                setGlanceInsight(fallback);
            } finally {
                if (glanceRequestIdRef.current === requestId) {
                    setIsGlanceLoading(false);
                }
            }
        })();
    }, [selectedAtom, atoms, connections]);

    const selectNode = useCallback((id: string | null) => {
        setSelectedNodeId(id);
        setRemoteInsight(null);
    }, []);

    const closeSelectedAtom = useCallback(() => {
        setSelectedNodeId(null);
        setRemoteInsight(null);
        setGlanceInsight(null);
        setIsGlanceLoading(false);
    }, []);

    const deepenSelectedAtom = useCallback(async () => {
        if (!selectedAtom) return;
        setIsSynthesizing(true);
        try {
            const relatedTitles = relatedAtoms.map((atom) => atom.title);
            setRemoteInsight(await synthesizeMemoryInsight(selectedAtom, {
                mode: 'deep',
                relatedTitles,
            }));
        } catch {
            setRemoteInsight('Could not deepen this memory right now.');
        } finally {
            setIsSynthesizing(false);
        }
    }, [selectedAtom, relatedAtoms]);

    return {
        atoms,
        connections,
        activeLayers,
        toggleLayer,
        selectedAtom,
        relatedAtoms,
        setSelectedNodeId: selectNode,
        closeSelectedAtom,
        searchQuery,
        setSearchQuery,
        isLoading,
        isGlanceLoading,
        isSynthesizing,
        /** AI-generated at-a-glance (auto on select). */
        localInsight: glanceInsight,
        /** @deprecated use remoteInsight — kept alias for older tests */
        insight: remoteInsight,
        remoteInsight,
        refresh,
        deepenSelectedAtom,
        /** @deprecated use deepenSelectedAtom */
        synthesizeSelectedAtom: deepenSelectedAtom,
    };
}
