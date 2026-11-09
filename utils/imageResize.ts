/**
 * Downscaling a picked photo, where the platform cannot do it (Kaneo #106).
 *
 * A phone build would need an image manipulator; this build does not ship one, so
 * the photo is stored at whatever the picker produced, already JPEG-compressed by
 * its quality setting. Returning the input unchanged is the contract - the caller
 * still gets a photo, just a larger one.
 */
import { fitWithin, PHOTO_MAX_EDGE } from '@/services/journal/entryPhotos';

export interface ResizedPhoto {
    dataUrl: string;
    width: number;
    height: number;
}

export async function downscalePhoto(
    photo: ResizedPhoto,
    maxEdge: number = PHOTO_MAX_EDGE,
): Promise<ResizedPhoto> {
    const target = fitWithin(photo.width, photo.height, maxEdge);
    return { ...photo, ...target };
}
