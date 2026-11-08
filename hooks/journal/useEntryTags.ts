/**
 * Writer-chosen labels for screens. The storage service is the single source
 * of truth and notifies every subscriber on a write (and on account teardown),
 * so a label added in entry detail is visible on Archive immediately — no
 * focus polling, no skeleton flash (R1 in ui-performance-rules.md).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useActiveAccountId } from '@/hooks/account/useActiveAccountId';
import {
    addEntryTag,
    type EntryTagMap,
    listEntryTags,
    removeEntryTag,
    subscribeEntryTagChanges,
} from '@/services/journal/entryTags';

export interface UseEntryTagsReturn {
    readonly tagsByEntry: EntryTagMap;
    readonly tagsFor: (entryId: string) => readonly string[];
    readonly addTag: (entryId: string, label: string) => Promise<void>;
    readonly removeTag: (entryId: string, label: string) => Promise<void>;
    readonly refresh: () => Promise<void>;
}

export function useEntryTags(): UseEntryTagsReturn {
    const accountId = useActiveAccountId();
    const [tagsByEntry, setTagsByEntry] = useState<EntryTagMap>({});

    const refresh = useCallback(async () => {
        try {
            setTagsByEntry(await listEntryTags());
        } catch {
            // A corrupt key must not blank the screen; keep the last good map.
        }
    }, []);

    useEffect(() => {
        let isActive = true;
        void listEntryTags().then((map) => {
            if (isActive) setTagsByEntry(map);
        }).catch(() => undefined);
        const unsubscribe = subscribeEntryTagChanges((map) => {
            if (isActive) setTagsByEntry(map);
        });
        return () => {
            isActive = false;
            unsubscribe();
        };
    }, [accountId]);

    const tagsFor = useCallback(
        (entryId: string) => tagsByEntry[entryId] ?? [],
        [tagsByEntry],
    );
    const addTag = useCallback(async (entryId: string, label: string) => {
        await addEntryTag(entryId, label);
    }, []);
    const removeTag = useCallback(async (entryId: string, label: string) => {
        await removeEntryTag(entryId, label);
    }, []);

    return useMemo(() => ({ tagsByEntry, tagsFor, addTag, removeTag, refresh }), [
        tagsByEntry, tagsFor, addTag, removeTag, refresh,
    ]);
}
