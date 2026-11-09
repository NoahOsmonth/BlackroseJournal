/**
 * Downscaling a picked photo in the browser (Kaneo #106).
 *
 * The picker hands back a base64 data URL. A phone photo is 3-8 MB; storing that
 * would blow the per-key budget, so it is drawn onto a canvas at the fitted size
 * and re-encoded as JPEG before it ever reaches storage.
 *
 * Returns the original on any failure: a larger photo is a much better outcome
 * than a lost one.
 */
import { fitWithin, PHOTO_MAX_EDGE, PHOTO_QUALITY } from '@/services/journal/entryPhotos';

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
    if (typeof document === 'undefined' || target.width === 0) return photo;

    try {
        const image = new Image();
        const loaded = await new Promise<boolean>((resolve) => {
            image.onload = () => resolve(true);
            image.onerror = () => resolve(false);
            image.src = photo.dataUrl;
        });
        if (!loaded) return photo;

        const canvas = document.createElement('canvas');
        canvas.width = target.width;
        canvas.height = target.height;
        const context = canvas.getContext('2d');
        if (!context) return photo;
        context.drawImage(image, 0, 0, target.width, target.height);
        return {
            dataUrl: canvas.toDataURL('image/jpeg', PHOTO_QUALITY),
            width: target.width,
            height: target.height,
        };
    } catch {
        return photo;
    }
}
