/**
 * Starred entries state for screens. The storage service is the single source
 * of truth and notifies every subscriber on a write, so a star tapped in entry
 * detail is visible on Archive immediately — no navigation dependency, no
 * focus polling, and no skeleton flash (R1 in ui-performance-rules.md).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useActiveAccountId } from '@/hooks/account/useActiveAccountId';
import {
    listStarredEntryIds,
    subscribeStarredChanges,
    toggleStarredEntry,
} from '@/services/journal/starredEntries';

export interface UseStarredEntriesReturn {
    readonly starredIds: readonly string[];
    readonly starredSet: ReadonlySet<string>;
    readonly isStarred: (id: string) => boolean;
    readonly toggleStar: (id: string) => Promise<void>;
    readonly refresh: () => Promise<void>;
}

export function useStarredEntries(): UseStarredEntriesReturn {
    const accountId = useActiveAccountId();
    const [starredIds, setStarredIds] = useState<readonly string[]>([]);

    const refresh = useCallback(async () => {
        try {
            setStarredIds(await listStarredEntryIds());
        } catch {
            // A corrupt key must not blank the screen; keep the last good list.
        }
    }, []);

    // Initial load, subscribe to writes, and reset when the account changes.
    useEffect(() => {
        setStarredIds([]);
        if (accountId) void refresh();
        return subscribeStarredChanges((ids) => setStarredIds([...ids]));
    }, [accountId, refresh]);

    const toggleStar = useCallback(async (id: string) => {
        // Optimistic update so the star responds on the same frame as the tap.
        setStarredIds((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return [...next];
        });
        try {
            // The service's notification reconciles this and all other screens.
            await toggleStarredEntry(id);
        } catch {
            await refresh();
        }
    }, [refresh]);

    const starredSet = useMemo(() => new Set(starredIds), [starredIds]);
    const isStarred = useCallback((id: string) => starredSet.has(id), [starredSet]);

    return { starredIds, starredSet, isStarred, toggleStar, refresh };
}
