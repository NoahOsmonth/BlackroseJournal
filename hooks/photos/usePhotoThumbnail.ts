/**
 * One thumbnail for one cell (Kaneo #109).
 *
 * Loading every photo up front would read megabytes to draw a grid that shows a
 * screenful. Each cell asks for its own, and a small cache keeps a cell from
 * re-reading when the list recycles.
 */
import { useEffect, useState } from 'react';

import { readEntryPhoto } from '@/services/journal/entryPhotos';

const cache = new Map<string, string | null>();

/** Test seam: the cache is process-wide, so a test must be able to empty it. */
export function clearPhotoThumbnailCache(): void {
    cache.clear();
}

export function usePhotoThumbnail(entryId: string): string | null {
    const [dataUrl, setDataUrl] = useState<string | null>(() => cache.get(entryId) ?? null);

    useEffect(() => {
        let active = true;
        if (cache.has(entryId)) {
            setDataUrl(cache.get(entryId) ?? null);
            return () => { active = false; };
        }
        void readEntryPhoto(entryId).then((photo) => {
            const value = photo ? photo.dataUrl : null;
            cache.set(entryId, value);
            if (active) setDataUrl(value);
        });
        return () => { active = false; };
    }, [entryId]);

    return dataUrl;
}