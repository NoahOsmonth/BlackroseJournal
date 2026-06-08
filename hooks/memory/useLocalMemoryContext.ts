import { useCallback, useEffect, useState } from 'react';
import { buildLocalMemoryContext } from '@/services/memory/localMemory';

interface UseLocalMemoryContextOptions {
    query?: string;
    enabled?: boolean;
}

interface UseLocalMemoryContextReturn {
    context: string | undefined;
    isLoading: boolean;
    refresh: () => Promise<void>;
}

export function useLocalMemoryContext({
    query,
    enabled = true,
}: UseLocalMemoryContextOptions = {}): UseLocalMemoryContextReturn {
    const [context, setContext] = useState<string | undefined>();
    const [isLoading, setIsLoading] = useState(enabled);

    const refresh = useCallback(async () => {
        if (!enabled) {
            setContext(undefined);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const nextContext = await buildLocalMemoryContext({ query, limit: 8 });
        setContext(nextContext);
        setIsLoading(false);
    }, [enabled, query]);

    useEffect(() => {
        let active = true;
        refresh().catch(() => {
            if (active) setIsLoading(false);
        });
        return () => {
            active = false;
        };
    }, [refresh]);

    return { context, isLoading, refresh };
}
