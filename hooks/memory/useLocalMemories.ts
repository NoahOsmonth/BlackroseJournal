import { useCallback, useEffect, useState } from 'react';
import {
    clearMemoryAtoms,
    deleteMemoryAtom,
    generateMemoryNoteSuggestion,
    listMemoryAtoms,
    saveGeneratedMemoryNote,
    saveManualMemoryNote,
    subscribeMemoryChanges,
} from '@/services/memory/localMemory';
import type { LocalMemoryAtom } from '@/services/memory/localMemory.types';

interface UseLocalMemoriesReturn {
    atoms: LocalMemoryAtom[];
    isLoading: boolean;
    generatedNote: string;
    refresh: () => Promise<void>;
    addNote: (content: string) => Promise<void>;
    addGeneratedNote: () => Promise<void>;
    refreshGeneratedNote: () => void;
    removeAtom: (id: string) => Promise<void>;
    clearAll: () => Promise<void>;
}

export function useLocalMemories(): UseLocalMemoriesReturn {
    const [atoms, setAtoms] = useState<LocalMemoryAtom[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [generatedNote, setGeneratedNote] = useState('');

    const refresh = useCallback(async () => {
        setIsLoading(true);
        const nextAtoms = await listMemoryAtoms();
        setAtoms(nextAtoms);
        setGeneratedNote(generateMemoryNoteSuggestion(nextAtoms) ?? '');
        setIsLoading(false);
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
        removeAtom,
        clearAll,
    };
}
