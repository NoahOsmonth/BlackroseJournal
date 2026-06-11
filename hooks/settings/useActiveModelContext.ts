import { useCallback, useEffect, useState } from 'react';
import {
    detectActiveModelContextWindow,
    type ModelContextInfo,
} from '@/services/ai/modelContext';

export interface UseActiveModelContextReturn {
    context: ModelContextInfo | null;
    error: string | null;
    isLoading: boolean;
    refresh: () => Promise<void>;
}

function messageForError(error: unknown): string {
    return error instanceof Error ? error.message : 'Could not detect the active model context.';
}

export function useActiveModelContext(): UseActiveModelContextReturn {
    const [context, setContext] = useState<ModelContextInfo | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const load = useCallback(async (forceRefresh = false) => {
        setIsLoading(true);
        setError(null);
        try {
            setContext(await detectActiveModelContextWindow({ forceRefresh }));
        } catch (nextError) {
            setError(messageForError(nextError));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        let mounted = true;
        load().finally(() => {
            if (!mounted) return;
        });
        return () => {
            mounted = false;
        };
    }, [load]);

    const refresh = useCallback(() => load(true), [load]);

    return { context, error, isLoading, refresh };
}
