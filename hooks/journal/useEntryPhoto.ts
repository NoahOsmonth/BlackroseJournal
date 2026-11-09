/**
 * The photo on one entry (Kaneo #106).
 *
 * Reads its own key, so the entries collection is never touched and no other
 * screen pays for a photo it does not show.
 */
import { useCallback, useEffect, useState } from 'react';

import {
    EntryPhoto,
    readEntryPhoto,
    removeEntryPhoto,
    saveEntryPhoto,
} from '@/services/journal/entryPhotos';
import { pickEntryPhoto } from '@/utils/photoPicker';

export interface UseEntryPhotoReturn {
    readonly photo: EntryPhoto | null;
    readonly isBusy: boolean;
    readonly message: string | null;
    readonly addPhoto: () => Promise<void>;
    readonly clearPhoto: () => Promise<void>;
}

export function useEntryPhoto(entryId: string | null): UseEntryPhotoReturn {
    const [photo, setPhoto] = useState<EntryPhoto | null>(null);
    const [isBusy, setIsBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        if (!entryId) {
            setPhoto(null);
            return () => { active = false; };
        }
        void readEntryPhoto(entryId).then((next) => {
            if (active) setPhoto(next);
        });
        return () => { active = false; };
    }, [entryId]);

    const addPhoto = useCallback(async () => {
        if (!entryId || isBusy) return;
        setIsBusy(true);
        setMessage(null);
        try {
            const picked = await pickEntryPhoto();
            // A cancel is not a failure and says nothing.
            if (!picked) return;
            const saved = await saveEntryPhoto(entryId, picked);
            if (!saved) {
                setMessage('That photo is too big to keep. Try a smaller one.');
                return;
            }
            setPhoto(await readEntryPhoto(entryId));
            setMessage('Photo added.');
        } catch {
            setMessage('The photo could not be added. Try again in a moment.');
        } finally {
            setIsBusy(false);
        }
    }, [entryId, isBusy]);

    const clearPhoto = useCallback(async () => {
        if (!entryId || isBusy) return;
        setIsBusy(true);
        setMessage(null);
        try {
            await removeEntryPhoto(entryId);
            setPhoto(null);
            setMessage('Photo removed.');
        } finally {
            setIsBusy(false);
        }
    }, [entryId, isBusy]);

    return { photo, isBusy, message, addPhoto, clearPhoto };
}
