import { useCallback, useEffect, useState } from 'react';
import { subscribeHindsightChanges } from '@/services/memory/hindsight/hindsightClient';
import { buildHindsightRecallContext } from '@/services/memory/hindsight/hindsightRecall';

interface UseHindsightRecallContextOptions {
    query?: string;
    enabled?: boolean;
    limit?: number;
}

interface UseHindsightRecallContextReturn {
    context: string | undefined;
    isLoading: boolean;
    refresh: () => Promise<void>;
}

export function useHindsightRecallContext({
    query,
    enabled = true,
    limit,
}: UseHindsightRecallContextOptions = {}): UseHindsightRecallContextReturn {
    const [context, setContext] = useState<string | undefined>();
    const [isLoading, setIsLoading] = useState(enabled);

    const refresh = useCallback(async () => {
        if (!enabled || !query?.trim()) {
            setContext(undefined);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            setContext(await buildHindsightRecallContext(query, { limit }));
        } finally {
            setIsLoading(false);
        }
    }, [enabled, query, limit]);

    useEffect(() => {
        refresh().catch(() => undefined);
        return subscribeHindsightChanges(() => {
            refresh().catch(() => undefined);
        });
    }, [refresh]);

    return { context, isLoading, refresh };
}
