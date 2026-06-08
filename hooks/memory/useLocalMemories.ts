import { useCallback, useEffect, useState } from 'react';
import {
    clearMemoryAtoms,
    listMemoryAtoms,
    saveManualMemoryNote,
} from '@/services/memory/localMemory';
import type { LocalMemoryAtom } from '@/services/memory/localMemory.types';

interface UseLocalMemoriesReturn {
    atoms: LocalMemoryAtom[];
    isLoading: boolean;
    refresh: () => Promise<void>;
    addNote: (content: string) => Promise<void>;
    clearAll: () => Promise<void>;
}

export function useLocalMemories(): UseLocalMemoriesReturn {
    const [atoms, setAtoms] = useState<LocalMemoryAtom[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        const nextAtoms = await listMemoryAtoms();
        setAtoms(nextAtoms);
        setIsLoading(false);
    }, []);

    const addNote = useCallback(async (content: string) => {
        const trimmed = content.trim();
        if (!trimmed) return;
        await saveManualMemoryNote(trimmed);
        await refresh();
    }, [refresh]);

    const clearAll = useCallback(async () => {
        await clearMemoryAtoms();
        await refresh();
    }, [refresh]);

    useEffect(() => {
        refresh().catch(() => setIsLoading(false));
    }, [refresh]);

    return { atoms, isLoading, refresh, addNote, clearAll };
}
