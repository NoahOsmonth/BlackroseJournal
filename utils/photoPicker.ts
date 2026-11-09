/**
 * Picking one photo for an entry (Kaneo #106).
 *
 * expo-image-picker is already a dependency and works on web through a file
 * input, so nothing new is installed. The picker's quality setting does the first
 * compression; downscalePhoto does the rest per platform.
 *
 * Returns null when the writer cancels or the picker is unavailable. Cancel is not
 * an error and must not produce a message.
 */
import * as ImagePicker from 'expo-image-picker';

import { downscalePhoto, ResizedPhoto } from '@/utils/imageResize';

export async function pickEntryPhoto(): Promise<ResizedPhoto | null> {
    try {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: false,
            base64: true,
            quality: 0.72,
        });
        if (result.canceled || !result.assets || result.assets.length === 0) return null;
        const asset = result.assets[0];
        if (!asset.base64) return null;
        const mime = asset.mimeType && asset.mimeType.startsWith('image/') ? asset.mimeType : 'image/jpeg';
        return await downscalePhoto({
            dataUrl: 'data:' + mime + ';base64,' + asset.base64,
            width: asset.width ?? 0,
            height: asset.height ?? 0,
        });
    } catch {
        return null;
    }
}
