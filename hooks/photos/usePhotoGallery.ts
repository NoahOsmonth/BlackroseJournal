/**
 * Every photo in the journal, newest first (Kaneo #109).
 *
 * Reads the lightweight index, never the photo bodies: the grid loads one
 * thumbnail at a time as cells appear.
 */
import { useEffect, useState } from 'react';

import { subscribeCollectionChanges } from '@/services/account/accountScopedStorage';
import { EntryPhotoIndexRow, listEntryPhotoIndex } from '@/services/journal/entryPhotos';

export interface UsePhotoGalleryReturn {
    readonly rows: readonly EntryPhotoIndexRow[];
    readonly isLoading: boolean;
}

export function usePhotoGallery(): UsePhotoGalleryReturn {
    const [rows, setRows] = useState<readonly EntryPhotoIndexRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let active = true;

        const load = async () => {
            const next = await listEntryPhotoIndex();
            if (!active) return;
            setRows(next);
            setIsLoading(false);
        };

        void load();
        const unsubscribe = subscribeCollectionChanges((key) => {
            if (key.includes('blackrose_entry_photo')) void load();
        });
        return () => {
            active = false;
            unsubscribe();
        };
    }, []);

    return { rows, isLoading };
}