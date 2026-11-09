/**
 * The photo on an entry (Kaneo #106).
 *
 * Renders nothing when there is no photo: an empty frame on every text-only entry
 * would be a permanent reminder of a feature the writer is not using.
 */
import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';

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
    if (!photo) return null;

    return (
        <View className="gap-2 px-6 pb-3" testID="entry-photo">
            <View className={frame}>
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
            </View>
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
        </View>
    );
}
