import { useCallback, useEffect, useRef, useState } from 'react';
import {
    clearMemoryAtoms,
    deleteMemoryAtom,
    generateMemoryNoteSuggestion,
    listMemoryAtoms,
    saveGeneratedMemoryNote,
    saveManualMemoryNote,
    subscribeMemoryChanges,
} from '@/services/memory/localMemory';
import { saveExploreNote } from '@/services/memory/exploreNote';
import type { ExploreNoteResult } from '@/services/memory/exploreNote';
import type { LocalMemoryAtom } from '@/services/memory/localMemory.types';

interface UseLocalMemoriesReturn {
    atoms: LocalMemoryAtom[];
    isLoading: boolean;
    generatedNote: string;
    refresh: () => Promise<void>;
    addNote: (content: string) => Promise<void>;
    addGeneratedNote: () => Promise<void>;
    refreshGeneratedNote: () => void;
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
    const [generatedNote, setGeneratedNote] = useState('');
    const hasLoadedRef = useRef(false);

    const refresh = useCallback(async () => {
        // Full-page spinner only on first load — keep the list mounted after that.
        if (!hasLoadedRef.current) {
            setIsLoading(true);
        }
        try {
            const nextAtoms = await listMemoryAtoms();
            setAtoms(nextAtoms);
            setGeneratedNote(generateMemoryNoteSuggestion(nextAtoms) ?? '');
            hasLoadedRef.current = true;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const addNote = useCallback(async (content: string) => {
        const trimmed = content.trim();
        if (!trimmed) return;
        await saveManualMemoryNote(trimmed);
        await refresh();
    }, [refresh]);

    const addGeneratedNote = useCallback(async () => {
        const trimmed = generatedNote.trim();
        if (!trimmed) return;
        await saveGeneratedMemoryNote(trimmed);
        await refresh();
    }, [generatedNote, refresh]);

    const refreshGeneratedNote = useCallback(() => {
        setGeneratedNote(generateMemoryNoteSuggestion(atoms) ?? '');
    }, [atoms]);

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
        generatedNote,
        refresh,
        addNote,
        addGeneratedNote,
        refreshGeneratedNote,
        addExploreNote,
        removeAtom,
        clearAll,
    };
}
