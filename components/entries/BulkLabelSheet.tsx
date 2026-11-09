/**
 * Put one label on several picked entries at once. Same sheet contract as the
 * rename sheet: the KeyboardAvoidingView is the backdrop (so the sheet rides
 * above the keyboard), a full-bleed Pressable dismisses, and the content is a
 * plain View anchored to the bottom.
 */
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/theme/use-color-scheme';
import { normalizeTag } from '@/utils/entryTags';

const SERIF = { fontFamily: 'PlayfairDisplayRegular' };
const HAIRLINE = 'border-hairline-light dark:border-hairline-dark';
const INK = 'text-text-light dark:text-text-dark';
const QUIET = 'text-text-secondary-light dark:text-text-secondary-dark';

interface BulkLabelSheetProps {
    readonly visible: boolean;
    /** How many entries the label will be added to. */
    readonly count: number;
    readonly onCancel: () => void;
    readonly onSubmit: (label: string) => void;
}

export function BulkLabelSheet({ visible, count, onCancel, onSubmit }: BulkLabelSheetProps) {
    const insets = useSafeAreaInsets();
    const isDark = useColorScheme() === 'dark';
    const placeholder = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;
    const [draft, setDraft] = useState('');
    const [refused, setRefused] = useState(false);

    // Every open starts empty: the previous label is not what they asked for.
    useEffect(() => {
        if (!visible) return;
        setDraft('');
        setRefused(false);
    }, [visible]);

    const submit = () => {
        const next = normalizeTag(draft);
        if (next.length === 0) {
            setRefused(true);
            return;
        }
        onSubmit(next);
    };

    const summary = count === 1
        ? 'This adds one label to 1 entry.'
        : `This adds one label to ${count} entries.`;

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
            <KeyboardAvoidingView behavior="padding" className="flex-1 justify-end bg-black/50">
                <Pressable className="flex-1" onPress={onCancel} accessibilityLabel="Dismiss" />
                <View
                    className="rounded-t-sheet border-t border-hairline-light bg-surface-light px-6 pt-3 dark:border-hairline-dark dark:bg-surface-dark"
                    style={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
                    testID="bulk-label-sheet"
                >
                    <View className="mb-5 h-1 w-10 self-center rounded-full bg-hairline-light dark:bg-hairline-dark" />
                    <Text className={`text-[26px] leading-[34px] ${INK}`} style={SERIF}>
                        Label these entries
                    </Text>
                    <Text className={`mt-2 text-[14px] leading-[20px] ${QUIET}`}>
                        {summary}
                    </Text>
                    <TextInput
                        value={draft}
                        onChangeText={(value) => {
                            setDraft(value);
                            if (refused) setRefused(false);
                        }}
                        placeholder="A word that means something to you"
                        placeholderTextColor={placeholder}
                        accessibilityLabel="A name for this label"
                        testID="bulk-label-input"
                        autoFocus
                        maxLength={40}
                        className={`mt-4 min-h-12 rounded-control border ${HAIRLINE} px-4 py-3 text-[16px] ${INK}`}
                    />
                    {refused ? (
                        <Text className={`mt-2 text-[13px] ${QUIET}`} testID="bulk-label-refused">
                            Give the label a name first.
                        </Text>
                    ) : null}
                    <View className="mt-6 flex-row gap-4">
                        <Pressable
                            onPress={onCancel}
                            accessibilityRole="button"
                            accessibilityLabel="Cancel"
                            testID="bulk-label-cancel"
                            className={`min-h-12 flex-1 items-center justify-center rounded-control border ${HAIRLINE}`}
                        >
                            <Text className={`text-[16px] ${INK}`}>Cancel</Text>
                        </Pressable>
                        <Pressable
                            onPress={submit}
                            accessibilityRole="button"
                            accessibilityLabel="Add this label to the picked entries"
                            testID="bulk-label-save"
                            className="min-h-12 flex-1 items-center justify-center rounded-control bg-accent-green dark:bg-accent-green-dark"
                        >
                            <Text className="text-[16px] text-white dark:text-white">Add label</Text>
                        </Pressable>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
