import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';

const SERIF = { fontFamily: 'PlayfairDisplayRegular' };
const HAIRLINE = 'border-hairline-light dark:border-hairline-dark';
const BONE = 'border-bone-light dark:border-bone-dark';

interface EntryEditModalProps {
    visible: boolean;
    /** Current authored text of the entry; the sheet opens in view mode. */
    entryText: string;
    entryTitle: string;
    isSaving: boolean;
    isDeleting: boolean;
    error: string | null;
    onClose: () => void;
    onSave: (text: string) => void;
    onDelete: () => void;
}

/**
 * Entry action sheet: overflow verbs (Edit / Delete) plus the inline editor.
 *
 * JOURNAL-11 requires a confirm before a destructive delete. `window.confirm`
 * on web matches the settings rows (Alert.alert is a no-op under
 * react-native-web — see DEF-009); native keeps the Alert path.
 */
export function EntryEditModal({
    visible,
    entryText,
    entryTitle,
    isSaving,
    isDeleting,
    error,
    onClose,
    onSave,
    onDelete,
}: EntryEditModalProps) {
    const insets = useSafeAreaInsets();
    const isDark = useColorScheme() === 'dark';
    const quietInk = isDark ? '#8A8580' : '#6B6560';

    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(entryText);

    useEffect(() => {
        if (visible) {
            setIsEditing(false);
            setDraft(entryText);
        }
    }, [visible, entryText]);

    const confirmDelete = async () => {
        if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
            const ok = window.confirm(
                'Delete this entry? Its memories and digests are removed with it. This cannot be undone.',
            );
            if (!ok) return;
        } else {
            const { Alert } = await import('react-native');
            const confirmed = await new Promise<boolean>((resolve) => {
                Alert.alert('Delete entry', 'This cannot be undone.', [
                    { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                    { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
                ]);
            });
            if (!confirmed) return;
        }
        onDelete();
    };

    const busy = isSaving || isDeleting;

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View className="flex-1 justify-end bg-black/50">
                <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Dismiss" />
                <View
                    className="rounded-t-sheet border-t border-hairline-light bg-surface-light px-6 pt-3 dark:border-hairline-dark dark:bg-surface-dark"
                    style={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
                >
                    <View className="mb-5 h-1 w-10 self-center rounded-full bg-hairline-light dark:bg-hairline-dark" />

                    <Text
                        className="text-[26px] leading-[34px] text-text-light dark:text-text-dark"
                        style={SERIF}
                        numberOfLines={1}
                    >
                        {isEditing ? 'Edit entry' : entryTitle}
                    </Text>

                    {error && (
                        <Text
                            className="mt-3 text-[13px] text-danger-light dark:text-danger-dark"
                            accessibilityLiveRegion="polite"
                        >
                            {error}
                        </Text>
                    )}

                    {isEditing ? (
                        <>
                            <TextInput
                                value={draft}
                                onChangeText={setDraft}
                                multiline
                                accessibilityLabel="Entry text"
                                placeholder="Write your entry"
                                placeholderTextColor={quietInk}
                                className={`mt-4 min-h-[160px] rounded-control border ${HAIRLINE} px-4 py-3 text-[16px] text-text-light dark:text-text-dark`}
                                style={{ textAlignVertical: 'top' }}
                            />
                            <View className="mt-6 flex-row gap-4">
                                <Pressable
                                    onPress={() => setIsEditing(false)}
                                    accessibilityRole="button"
                                    accessibilityLabel="Cancel edit"
                                    className={`min-h-12 flex-1 items-center justify-center rounded-control border ${HAIRLINE}`}
                                >
                                    <Text className="text-[17px] text-text-light dark:text-text-dark" style={SERIF}>
                                        Cancel
                                    </Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => onSave(draft)}
                                    disabled={busy || !draft.trim()}
                                    accessibilityRole="button"
                                    accessibilityLabel="Save entry"
                                    className={`min-h-12 flex-1 items-center justify-center rounded-control border ${BONE} ${busy || !draft.trim() ? 'opacity-50' : ''}`}
                                >
                                    {isSaving ? (
                                        <ActivityIndicator color={quietInk} />
                                    ) : (
                                        <Text className="text-[17px] text-text-light dark:text-text-dark" style={SERIF}>
                                            Save
                                        </Text>
                                    )}
                                </Pressable>
                            </View>
                        </>
                    ) : (
                        <View className="mt-6 gap-3">
                            <Pressable
                                onPress={() => setIsEditing(true)}
                                accessibilityRole="button"
                                accessibilityLabel="Edit entry"
                                className={`min-h-12 items-center justify-center rounded-control border ${BONE}`}
                            >
                                <Text className="text-[17px] text-text-light dark:text-text-dark" style={SERIF}>
                                    Edit entry
                                </Text>
                            </Pressable>
                            <Pressable
                                onPress={confirmDelete}
                                disabled={busy}
                                accessibilityRole="button"
                                accessibilityLabel="Delete entry"
                                className={`min-h-12 items-center justify-center rounded-control border ${HAIRLINE} ${busy ? 'opacity-50' : ''}`}
                            >
                                {isDeleting ? (
                                    <ActivityIndicator color={quietInk} />
                                ) : (
                                    <Text className="text-[17px] text-danger-light dark:text-danger-dark" style={SERIF}>
                                        Delete entry
                                    </Text>
                                )}
                            </Pressable>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
}
