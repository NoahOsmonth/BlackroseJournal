/**
 * Subscribe a collection hook to real storage writes (Kaneo #87).
 *
 * A tab screen no longer re-reads four whole collections just because it was
 * focused. Instead every write — from a hook, a backup restore, a demo seed
 * row, or an Explore note — emits the owning key through the storage adapter,
 * and only hooks that care about that key refresh. The refresh is scheduled on
 * the microtask queue so a burst of shard writes collapses into one load.
 */
import { useEffect } from 'react';

import { subscribeCollectionChanges } from '@/services/account/accountScopedStorage';

export function useCollectionRefresh(
    watchedKeys: readonly string[],
    refresh: () => void,
): void {
    useEffect(() => {
        let scheduled = false;
        const unsubscribe = subscribeCollectionChanges((ownerKey) => {
            if (!watchedKeys.includes(ownerKey)) return;
            if (scheduled) return;
            scheduled = true;
            Promise.resolve().then(() => {
                scheduled = false;
                refresh();
            });
        });
        return unsubscribe;
    }, [watchedKeys, refresh]);
}
