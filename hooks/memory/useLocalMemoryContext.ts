import { useCallback, useEffect, useState } from 'react';
import { buildLocalMemoryContext, subscribeMemoryChanges } from '@/services/memory/localMemory';

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
        try {
            const nextContext = await buildLocalMemoryContext({ query });
            setContext(nextContext);
        } finally {
            setIsLoading(false);
        }
    }, [enabled, query]);

    useEffect(() => {
        refresh().catch(() => undefined);
        return subscribeMemoryChanges(() => {
            refresh().catch(() => undefined);
        });
    }, [refresh]);

    return { context, isLoading, refresh };
}
