/**
 * Every photo in the journal (Kaneo #109).
 *
 * A photo that lives on exactly one entry is findable only by remembering which
 * day it was on. This is the other way in.
 */
import React, { useCallback, useMemo } from 'react';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { EmptyState } from '@/components/ui/EmptyState';
import { PhotoGridCell } from '@/components/photos/PhotoGridCell';
import { useNavBack } from '@/hooks/navigation/useNavBack';
import { usePhotoGallery } from '@/hooks/photos/usePhotoGallery';

/** Two per row: a photo you can actually see beats a denser wall of squares. */
const COLUMNS = 2;

export default function PhotosScreen() {
    const router = useRouter();
    const goBack = useNavBack('/(tabs)/explore');
    const { rows, isLoading } = usePhotoGallery();

    const data = useMemo(() => rows.filter((row) => Boolean(row.entryId)), [rows]);

    const openEntry = useCallback(
        (entryId: string) => router.push({ pathname: '/entry-detail', params: { id: entryId } }),
        [router],
    );

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark">
            <View className="flex-row items-center gap-3 px-6 pb-2 pt-2">
                <Text
                    className="flex-1 text-[26px] text-text-light dark:text-text-dark"
                    style={{ fontFamily: 'PlayfairDisplayRegular' }}
                    accessibilityRole="header"
                >
                    Photos
                </Text>
            </View>

            {!isLoading && data.length === 0 && (
                <View className="flex-1 items-center justify-center px-6">
                    <EmptyState
                        icon="photo-library"
                        title="No photos yet"
                        message="Add a photo to a day and it will show up here."
                        actionLabel="Go back"
                        onActionPress={goBack}
                    />
                </View>
            )}

            {data.length > 0 && (
                <FlatList
                    testID="photo-grid"
                    data={data}
                    keyExtractor={(row) => row.entryId}
                    numColumns={COLUMNS}
                    contentContainerStyle={{ padding: 24, gap: 12 }}
                    columnWrapperStyle={{ gap: 12 }}
                    renderItem={({ item }) => (
                        <PhotoGridCell entryId={item.entryId} onOpen={() => openEntry(item.entryId)} />
                    )}
                />
            )}
        </SafeAreaView>
    );
}
