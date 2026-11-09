/**
 * Rename one label across the whole journal. A Modal, because overlay chrome
 * must be a Modal (the dock long-press shipped items outside its own box).
 * Merging into an existing name is the same operation as fixing a typo.
 */
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { webConfirm } from '@/components/ui/webConfirm';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatTagLabel, normalizeTag } from '@/utils/entryTags';

const SERIF = { fontFamily: 'PlayfairDisplayRegular' };
const HAIRLINE = 'border-hairline-light dark:border-hairline-dark';
const INK = 'text-text-light dark:text-text-dark';
const QUIET = 'text-text-secondary-light dark:text-text-secondary-dark';

interface TagRenameSheetProps {
    readonly visible: boolean;
    /** The label being renamed, already normalized. */
    readonly current: string;
    readonly onCancel: () => void;
    readonly onSubmit: (next: string) => void;
    /** Remove the label from every entry. Hidden when the screen cannot delete. */
    readonly onDelete?: (label: string) => void;
}

export function TagRenameSheet({ visible, current, onCancel, onSubmit, onDelete }: TagRenameSheetProps) {
    const insets = useSafeAreaInsets();
    const isDark = useColorScheme() === 'dark';
    const placeholder = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;
    const [draft, setDraft] = useState('');
    const [refused, setRefused] = useState(false);

    // Every open starts from the label being fixed, not from the last attempt.
    useEffect(() => {
        if (!visible) return;
        setDraft(formatTagLabel(current));
        setRefused(false);
    }, [visible, current]);

    // Deleting touches every entry that used the label, so it asks first.
    const remove = () => {
        if (!onDelete) return;
        const answer = webConfirm(
            'Delete the label "' + formatTagLabel(current) + '"? It will be removed from every entry that uses it.',
        );
        if (answer === false) return;
        onDelete(current);
    };

    const submit = () => {
        const next = normalizeTag(draft);
        if (next.length === 0) {
            setRefused(true);
            return;
        }
        onSubmit(next);
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
            <KeyboardAvoidingView behavior="padding" className="flex-1 justify-end bg-black/50">
                <Pressable className="flex-1" onPress={onCancel} accessibilityLabel="Dismiss" />
                <View
                    className="rounded-t-sheet border-t border-hairline-light bg-surface-light px-6 pt-3 dark:border-hairline-dark dark:bg-surface-dark"
                    style={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
                    testID="tag-rename-sheet"
                >
                    <View className="mb-5 h-1 w-10 self-center rounded-full bg-hairline-light dark:bg-hairline-dark" />
                    <Text className={`text-[26px] leading-[34px] ${INK}`} style={SERIF}>
                        Rename label
                    </Text>
                    <Text className={`mt-2 text-[14px] leading-[20px] ${QUIET}`}>
                        If that name is already in use, those entries join it.
                    </Text>
                    <TextInput
                        value={draft}
                        onChangeText={(text) => {
                            setDraft(text);
                            if (refused) setRefused(false);
                        }}
                        placeholder="A new name"
                        placeholderTextColor={placeholder}
                        accessibilityLabel="A new name for this label"
                        testID="tag-rename-input"
                        autoFocus
                        className={`mt-4 min-h-12 rounded-control border ${HAIRLINE} px-4 py-3 text-[16px] ${INK}`}
                    />
                    {refused ? (
                        <Text className={`mt-2 text-[13px] ${QUIET}`} testID="tag-rename-refused">
                            Give it a name first.
                        </Text>
                    ) : null}
                    <View className="mt-6 flex-row gap-4">
                        <Pressable
                            onPress={onCancel}
                            accessibilityRole="button"
                            accessibilityLabel="Keep the old name"
                            className={`min-h-12 flex-1 items-center justify-center rounded-control border ${HAIRLINE}`}
                        >
                            <Text className={`text-[16px] ${INK}`}>Cancel</Text>
                        </Pressable>
                        <Pressable
                            onPress={submit}
                            accessibilityRole="button"
                            accessibilityLabel="Save this name"
                            testID="tag-rename-save"
                            className="min-h-12 flex-1 items-center justify-center rounded-control bg-accent-green dark:bg-accent-green-dark"
                        >
                            <Text className="text-[16px] text-white dark:text-white">Save</Text>
                        </Pressable>
                    </View>
                    {onDelete ? (
                        <Pressable
                            onPress={remove}
                            accessibilityRole="button"
                            accessibilityLabel={'Delete the label ' + formatTagLabel(current)}
                            testID="tag-rename-delete"
                            className="mt-3 min-h-12 items-center justify-center rounded-control"
                        >
                            <Text className="text-[15px] text-danger-light dark:text-danger-dark">Delete this label</Text>
                        </Pressable>
                    ) : null}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
