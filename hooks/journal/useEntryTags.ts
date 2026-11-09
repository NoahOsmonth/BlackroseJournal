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
    addEntryTagToMany,
    deleteEntryTag,
    type EntryTagMap,
    listEntryTags,
    removeEntryTag,
    renameEntryTag,
    subscribeEntryTagChanges,
} from '@/services/journal/entryTags';

export interface UseEntryTagsReturn {
    readonly tagsByEntry: EntryTagMap;
    readonly tagsFor: (entryId: string) => readonly string[];
    readonly addTag: (entryId: string, label: string) => Promise<void>;
    /** Add one label to several entries in a single write. */
    readonly addTagMany: (entryIds: readonly string[], label: string) => Promise<void>;
    readonly removeTag: (entryId: string, label: string) => Promise<void>;
    /** Rename one label everywhere, merging into the target when it exists. */
    readonly renameTag: (from: string, to: string) => Promise<void>;
    /** Remove one label from every entry that uses it. */
    readonly deleteTag: (label: string) => Promise<void>;
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
        // A write can land between the first read starting and resolving. The
        // subscription carries the fresher map, so the stale read must not
        // clobber it - otherwise a label added right after mount disappears.
        let notified = false;
        const unsubscribe = subscribeEntryTagChanges((map) => {
            notified = true;
            if (isActive) setTagsByEntry(map);
        });
        void listEntryTags().then((map) => {
            if (isActive && !notified) setTagsByEntry(map);
        }).catch(() => undefined);
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
    const addTagMany = useCallback(async (entryIds: readonly string[], label: string) => {
        await addEntryTagToMany(entryIds, label);
    }, []);
    const removeTag = useCallback(async (entryId: string, label: string) => {
        await removeEntryTag(entryId, label);
    }, []);
    const renameTag = useCallback(async (from: string, to: string) => {
        await renameEntryTag(from, to);
    }, []);
    const deleteTag = useCallback(async (label: string) => {
        await deleteEntryTag(label);
    }, []);

    return useMemo(
        () => ({ tagsByEntry, tagsFor, addTag, addTagMany, removeTag, renameTag, deleteTag, refresh }),
        [tagsByEntry, tagsFor, addTag, addTagMany, removeTag, renameTag, deleteTag, refresh],
    );
}
