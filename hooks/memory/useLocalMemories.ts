import { useCallback, useEffect, useState } from 'react';
import {
    clearMemoryAtoms,
    generateMemoryNoteSuggestion,
    listMemoryAtoms,
    saveGeneratedMemoryNote,
    saveManualMemoryNote,
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

    const clearAll = useCallback(async () => {
        await clearMemoryAtoms();
        await refresh();
    }, [refresh]);

    useEffect(() => {
        refresh().catch(() => setIsLoading(false));
    }, [refresh]);

    return {
        atoms,
        isLoading,
        generatedNote,
        refresh,
        addNote,
        addGeneratedNote,
        refreshGeneratedNote,
        clearAll,
    };
}
