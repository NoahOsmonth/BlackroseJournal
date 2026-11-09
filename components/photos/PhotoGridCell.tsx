/**
 * One photo in the grid (Kaneo #109).
 *
 * The cell owns its own read, so the grid never loads a photo it is not showing.
 * An entry whose photo has gone draws nothing rather than an empty frame.
 */
import React from 'react';
import { Image, Pressable, View } from 'react-native';

import { usePhotoThumbnail } from '@/hooks/photos/usePhotoThumbnail';

const CELL =
    'h-32 flex-1 rounded-card border border-hairline-light dark:border-hairline-dark overflow-hidden bg-surface-light dark:bg-surface-dark';

export function PhotoGridCell({ entryId, onOpen }: { entryId: string; onOpen: () => void }) {
    const dataUrl = usePhotoThumbnail(entryId);
    if (!dataUrl) return null;

    return (
        <Pressable
            className={CELL}
            onPress={onOpen}
            accessibilityRole="button"
            accessibilityLabel="Open the day this photo is from"
            testID={'photo-cell-' + entryId}
        >
            <View className="flex-1 overflow-hidden rounded-card">
                <Image
                    source={{ uri: dataUrl }}
                    resizeMode="cover"
                    style={{ width: '100%', height: '100%' }}
                    accessibilityLabel="A photo from your journal"
                />
            </View>
        </Pressable>
    );
}