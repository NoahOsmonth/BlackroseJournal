import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    activatePersona,
    createPersona,
    deletePersona,
    getActivePersona,
    listPersonas,
    updatePersona,
} from '@/services/personas/personasStorage';
import { Persona, PersonaCreateInput, PersonaUpdateInput } from '@/services/personas/personasStorage.types';

interface UsePersonasReturn {
    personas: Persona[];
    activePersona: Persona | null;
    isLoading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
    create: (input: PersonaCreateInput) => Promise<Persona>;
    update: (id: string, updates: PersonaUpdateInput) => Promise<Persona | null>;
    remove: (id: string) => Promise<boolean>;
    setActive: (id: string) => Promise<void>;
}

export function usePersonas(): UsePersonasReturn {
    const [personas, setPersonas] = useState<Persona[]>([]);
    const [activePersona, setActivePersona] = useState<Persona | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const list = await listPersonas();
            setPersonas(list);
            const active = await getActivePersona();
            setActivePersona(active);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load personas'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const create = useCallback(async (input: PersonaCreateInput) => {
        const persona = await createPersona(input);
        await refresh();
        return persona;
    }, [refresh]);

    const update = useCallback(async (id: string, updates: PersonaUpdateInput) => {
        const persona = await updatePersona(id, updates);
        await refresh();
        return persona;
    }, [refresh]);

    const remove = useCallback(async (id: string) => {
        const success = await deletePersona(id);
        await refresh();
        return success;
    }, [refresh]);

    const setActive = useCallback(async (id: string) => {
        await activatePersona(id);
        await refresh();
    }, [refresh]);

    const sorted = useMemo(
        () => [...personas].sort((a, b) => b.updatedAt - a.updatedAt),
        [personas]
    );

    return {
        personas: sorted,
        activePersona,
        isLoading,
        error,
        refresh,
        create,
        update,
        remove,
        setActive,
    };
}
