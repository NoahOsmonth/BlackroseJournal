import { useCallback, useEffect, useRef, useState } from 'react';
import {
    getActiveAccountId, subscribeActiveAccount,
} from '@/services/account/accountRuntime';
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
    /**
     * Resolve recall context for an arbitrary query (defaults to the hook's own
     * `query`). The send path awaits this so the outgoing message's recall lands in
     * the prompt BEFORE the stream — the reactive `query` path lags one turn.
     * Duplicate/concurrent queries share one request (embedding calls are metered).
     */
    recallFor: (text?: string) => Promise<string | undefined>;
}

export function useHindsightRecallContext({
    query,
    enabled = true,
    limit,
}: UseHindsightRecallContextOptions = {}): UseHindsightRecallContextReturn {
    const [context, setContext] = useState<string | undefined>();
    const [isLoading, setIsLoading] = useState(enabled);
    const accountRef = useRef(getActiveAccountId());
    const generationRef = useRef(0);
    const lastResolvedRef = useRef<{
        accountId: string | null;
        query: string;
        value: string | undefined;
    } | null>(null);
    const inflightRef = useRef<Map<string, Promise<string | undefined>>>(new Map());

    const resolve = useCallback(
        async (override?: string): Promise<string | undefined> => {
            const q = (override ?? query)?.trim() ?? '';
            const runtimeAccountId = getActiveAccountId();
            if (accountRef.current !== runtimeAccountId) {
                accountRef.current = runtimeAccountId;
                generationRef.current += 1;
                lastResolvedRef.current = null;
                inflightRef.current.clear();
            }
            const accountId = accountRef.current;
            const generation = generationRef.current;
            if (!enabled || !q) {
                setContext(undefined);
                setIsLoading(false);
                return undefined;
            }

            const cached = lastResolvedRef.current;
            if (cached && cached.accountId === accountId && cached.query === q) {
                setContext(cached.value);
                setIsLoading(false);
                return cached.value;
            }

            const requestKey = `${accountId ?? ''}\u0000${q}`;
            const isCurrentRequest = () => generationRef.current === generation
                && accountRef.current === accountId
                && getActiveAccountId() === accountId;
            const existing = inflightRef.current.get(requestKey);
            if (existing) {
                setIsLoading(true);
                const value = await existing;
                if (!isCurrentRequest()) return undefined;
                setContext(value);
                setIsLoading(false);
                return value;
            }

            setIsLoading(true);
            const pending = buildHindsightRecallContext(q, { limit })
                .catch(() => undefined)
                .then((value) => {
                    if (!isCurrentRequest()) return undefined;
                    lastResolvedRef.current = { accountId, query: q, value };
                    return value;
                })
                .finally(() => {
                    inflightRef.current.delete(requestKey);
                });
            inflightRef.current.set(requestKey, pending);

            const value = await pending;
            if (!isCurrentRequest()) return undefined;
            setContext(value);
            setIsLoading(false);
            return value;
        },
        [enabled, query, limit]
    );

    const refresh = useCallback(async () => {
        await resolve();
    }, [resolve]);

    useEffect(() => {
        return subscribeActiveAccount((accountId) => {
            accountRef.current = accountId;
            generationRef.current += 1;
            lastResolvedRef.current = null;
            inflightRef.current.clear();
            setContext(undefined);
            setIsLoading(false);
        });
    }, []);

    useEffect(() => {
        refresh().catch(() => undefined);
        return subscribeHindsightChanges(() => {
            refresh().catch(() => undefined);
        });
    }, [refresh]);

    return { context, isLoading, refresh, recallFor: resolve };
}
