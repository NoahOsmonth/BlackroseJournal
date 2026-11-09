/**
 * The entry photo, full screen (Kaneo #108).
 *
 * A photo the writer cannot look at properly is half a feature. This is the same
 * Modal idiom as the entry action sheet, so there is one overlay pattern rather
 * than two.
 *
 * Dismissal is deliberate: the scrim and the close button both work, and Escape
 * works on web. A press that merely ends here (a drag that started elsewhere) must
 * not dismiss it, so the scrim is its own pressable rather than the container.
 */
import React, { useEffect } from 'react';
import { Image, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CLOSE_LABEL = 'text-[15px] text-bone-light dark:text-bone-dark';

export function PhotoViewer({
    visible,
    dataUrl,
    onClose,
}: {
    visible: boolean;
    dataUrl: string | null;
    onClose: () => void;
}) {
    const insets = useSafeAreaInsets();

    useEffect(() => {
        if (!visible || typeof document === 'undefined') return undefined;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [visible, onClose]);

    if (!dataUrl) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View className="flex-1 bg-black/90" testID="photo-viewer">
                {/* Tapping the picture closes it too, but the scrim is not a
                    second control for a screen reader: the Close button below is
                    the one labelled control, so there is no duplicate name. */}
                <Pressable
                    className="flex-1 items-center justify-center p-4"
                    onPress={onClose}
                    accessible={false}
                    testID="photo-viewer-scrim"
                >
                    <Image
                        testID="photo-viewer-image"
                        source={{ uri: dataUrl }}
                        resizeMode="contain"
                        accessibilityLabel="Photo on this entry, full screen"
                        style={{ width: '100%', height: '100%' }}
                    />
                </Pressable>
                <Pressable
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel="Close the photo"
                    testID="photo-viewer-close"
                    className="absolute self-center h-11 w-24 items-center justify-center rounded-full bg-surface-light/20 dark:bg-surface-dark/40"
                    style={{ bottom: insets.bottom + 24 }}
                >
                    <Text className={CLOSE_LABEL}>Close</Text>
                </Pressable>
            </View>
        </Modal>
    );
}
