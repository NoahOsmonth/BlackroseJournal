/**
 * Starters the writer has finished. One subscription to the service owner;
 * a plain subscription, not a focus effect (round 34: that coupled the hook
 * to a navigation object and broke plain renders). The service stays the
 * source of truth — a tap on the shelf never marks anything written.
 */
import { useCallback, useEffect, useState } from 'react';

import {
    listWrittenStarters,
    subscribeWrittenStarters,
} from '@/services/prompts/writtenPromptStarters';

export interface UseWrittenStartersReturn {
    readonly writtenIds: readonly string[];
    readonly isLoading: boolean;
    readonly has: (id: string) => boolean;
}

export function useWrittenStarters(): UseWrittenStartersReturn {
    const [writtenIds, setWrittenIds] = useState<readonly string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let active = true;
        void listWrittenStarters().then((ids) => {
            if (active) {
                setWrittenIds(ids);
                setIsLoading(false);
            }
        }).catch(() => { if (active) setIsLoading(false); });
        const unsubscribe = subscribeWrittenStarters((ids) => {
            if (active) setWrittenIds(ids);
        });
        return () => {
            active = false;
            unsubscribe();
        };
    }, []);

    const has = useCallback((id: string) => writtenIds.includes(id), [writtenIds]);

    return { writtenIds, isLoading, has };
}
