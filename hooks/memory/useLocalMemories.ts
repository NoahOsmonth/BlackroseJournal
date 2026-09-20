import { useCallback, useEffect, useRef, useState } from 'react';
import {
    clearMemoryAtoms,
    deleteMemoryAtom,
    listMemoryAtoms,
    subscribeMemoryChanges,
} from '@/services/memory/localMemory';
import { saveExploreNote } from '@/services/memory/exploreNote';
import type { ExploreNoteResult } from '@/services/memory/exploreNote';
import type { LocalMemoryAtom } from '@/services/memory/localMemory.types';

interface UseLocalMemoriesReturn {
    atoms: LocalMemoryAtom[];
    isLoading: boolean;
    refresh: () => Promise<void>;
    /**
     * Keeps a note written on Explore. Goes through `saveExploreNote`, not a
     * bespoke atom write: the note must reach the memory-file store too, or
     * `memory_search` cannot see it. Returns the outcome so the screen can
     * report a partial write; `null` when the text was blank.
     */
    addExploreNote: (text: string) => Promise<ExploreNoteResult | null>;
    removeAtom: (id: string) => Promise<void>;
    clearAll: () => Promise<void>;
}

export function useLocalMemories(): UseLocalMemoriesReturn {
    const [atoms, setAtoms] = useState<LocalMemoryAtom[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const hasLoadedRef = useRef(false);

    const refresh = useCallback(async () => {
        // Full-page spinner only on first load — keep the list mounted after that.
        if (!hasLoadedRef.current) {
            setIsLoading(true);
        }
        try {
            const nextAtoms = await listMemoryAtoms();
            setAtoms(nextAtoms);
            hasLoadedRef.current = true;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const addExploreNote = useCallback(async (text: string) => {
        if (!text.trim()) return null;
        const result = await saveExploreNote({ text });
        await refresh();
        return result;
    }, [refresh]);

    const removeAtom = useCallback(async (id: string) => {
        await deleteMemoryAtom(id);
        await refresh();
    }, [refresh]);

    const clearAll = useCallback(async () => {
        await clearMemoryAtoms();
        await refresh();
    }, [refresh]);

    useEffect(() => {
        refresh().catch(() => setIsLoading(false));
        return subscribeMemoryChanges(() => {
            refresh().catch(() => setIsLoading(false));
        });
    }, [refresh]);

    return {
        atoms,
        isLoading,
        refresh,
        addExploreNote,
        removeAtom,
        clearAll,
    };
}
