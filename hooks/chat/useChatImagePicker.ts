import { useCallback, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { forgetImageDataUrl, primeImageDataUrl, type PickedChatImage } from '@/services/ai/chatImage';

export interface UseChatImagePickerReturn {
    /** The photo waiting to be sent with the next turn, if any. */
    pendingImage: PickedChatImage | null;
    isPicking: boolean;
    /** Opens the library. Returns the picked photo, or null if cancelled. */
    pickImage: () => Promise<PickedChatImage | null>;
    removeImage: () => void;
    /** Called after a send commits, so the chip does not linger. */
    consumeImage: () => void;
}

/** A photo nobody can send is worse than no photo: cap what we will carry. */
const MAX_BASE64_CHARS = 12 * 1024 * 1024;

/**
 * Attach a photo to the next chat turn. The picker hands back a local uri plus
 * its own base64; we keep both in memory only — `uri` is what gets persisted
 * with the message, the bytes are re-derived at request time (chatImage.ts).
 */
export function useChatImagePicker(): UseChatImagePickerReturn {
    const [pendingImage, setPendingImage] = useState<PickedChatImage | null>(null);
    const [isPicking, setIsPicking] = useState(false);

    const removeImage = useCallback(() => {
        setPendingImage((current) => {
            if (current?.uri) forgetImageDataUrl(current.uri);
            return null;
        });
    }, []);

    const pickImage = useCallback(async (): Promise<PickedChatImage | null> => {
        if (isPicking) return null;
        setIsPicking(true);
        try {
            if (Platform.OS !== 'web') {
                const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (!permission.granted) return null;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                base64: true,
                quality: 0.7,
            });
            if (result.canceled || !result.assets?.length) return null;

            const asset = result.assets[0];
            if (!asset?.uri) return null;

            const picked: PickedChatImage = {
                uri: asset.uri,
                mimeType: asset.mimeType ?? undefined,
                width: asset.width,
                height: asset.height,
                ...(asset.base64 && asset.base64.length <= MAX_BASE64_CHARS
                    ? { base64: asset.base64 }
                    : {}),
            };
            primeImageDataUrl(picked);
            setPendingImage((current) => {
                if (current?.uri && current.uri !== picked.uri) forgetImageDataUrl(current.uri);
                return picked;
            });
            return picked;
        } catch (error) {
            console.warn('Could not attach that photo:', error);
            return null;
        } finally {
            setIsPicking(false);
        }
    }, [isPicking]);

    const consumeImage = useCallback(() => {
        setPendingImage(null);
    }, []);

    return { pendingImage, isPicking, pickImage, removeImage, consumeImage };
}
