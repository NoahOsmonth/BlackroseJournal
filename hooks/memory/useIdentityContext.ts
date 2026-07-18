import { useCallback, useEffect, useState } from 'react';
import {
    buildIdentityContext,
    subscribeIdentityChanges,
} from '@/services/memory/identityProfile';

interface UseIdentityContextOptions {
    enabled?: boolean;
}

interface UseIdentityContextReturn {
    context: string | undefined;
    isLoading: boolean;
    refresh: () => Promise<void>;
}

/**
 * Loads the always-on identity prompt block and refreshes when the profile mutates
 * (turn-level extraction, finish extract, update_identity tool, settings clear).
 */
export function useIdentityContext({
    enabled = true,
}: UseIdentityContextOptions = {}): UseIdentityContextReturn {
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
            const next = await buildIdentityContext();
            setContext(next);
        } finally {
            setIsLoading(false);
        }
    }, [enabled]);

    useEffect(() => {
        refresh().catch(() => undefined);
        return subscribeIdentityChanges(() => {
            refresh().catch(() => undefined);
        });
    }, [refresh]);

    return { context, isLoading, refresh };
}
