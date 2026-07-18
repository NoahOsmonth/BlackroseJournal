import { useCallback, useEffect, useState } from 'react';
import { buildRecentDaysContext } from '@/services/memory/dayDigestStorage';
import { subscribeMemoryChanges } from '@/services/memory/localMemory';

interface UseRecentDaysContextOptions {
    days?: number;
    enabled?: boolean;
}

interface UseRecentDaysContextReturn {
    context: string | undefined;
    isLoading: boolean;
    refresh: () => Promise<void>;
}

/**
 * Loads recent day digests for system-prompt injection.
 * Reuses memory-change notifications as a coarse "history updated" signal
 * (digests are written alongside memory atoms on finish).
 */
export function useRecentDaysContext({
    days = 3,
    enabled = true,
}: UseRecentDaysContextOptions = {}): UseRecentDaysContextReturn {
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
            const next = await buildRecentDaysContext({ days });
            setContext(next);
        } finally {
            setIsLoading(false);
        }
    }, [days, enabled]);

    useEffect(() => {
        refresh().catch(() => undefined);
        return subscribeMemoryChanges(() => {
            refresh().catch(() => undefined);
        });
    }, [refresh]);

    return { context, isLoading, refresh };
}
