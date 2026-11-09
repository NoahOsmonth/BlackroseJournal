/**
 * The photo on an entry (Kaneo #106), openable full screen (Kaneo #108).
 *
 * Renders nothing when there is no photo: an empty frame on every text-only entry
 * would be a permanent reminder of a feature the writer is not using.
 *
 * The frame itself is the button that opens the viewer, so there is one obvious
 * target rather than a small expand icon nobody finds.
 */
import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { PhotoViewer } from '@/components/journal/PhotoViewer';
import { EntryPhoto as EntryPhotoModel } from '@/services/journal/entryPhotos';

const frame = 'overflow-hidden rounded-card border border-hairline-light dark:border-hairline-dark';
const removeLabel = 'text-[13px] text-text-secondary-light dark:text-text-secondary-dark';

export function EntryPhoto({
    photo,
    isBusy,
    onRemove,
}: {
    photo: EntryPhotoModel | null;
    isBusy: boolean;
    onRemove: () => void;
}) {
    const [isOpen, setIsOpen] = useState(false);

    if (!photo) return null;

    return (
        <View className="gap-2 px-6 pb-3" testID="entry-photo">
            <Pressable
                className={frame}
                onPress={() => setIsOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Open the photo full screen"
                testID="entry-photo-open"
            >
                <Image
                    testID="entry-photo-image"
                    source={{ uri: photo.dataUrl }}
                    accessibilityLabel="Photo on this entry"
                    resizeMode="cover"
                    style={{
                        width: '100%',
                        aspectRatio: photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 4 / 3,
                    }}
                />
            </Pressable>
            <Pressable
                onPress={onRemove}
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityLabel="Remove the photo from this entry"
                testID="entry-photo-remove"
                className="self-start py-1"
            >
                <Text className={removeLabel}>Remove photo</Text>
            </Pressable>
            <PhotoViewer visible={isOpen} dataUrl={photo.dataUrl} onClose={() => setIsOpen(false)} />
        </View>
    );
}
