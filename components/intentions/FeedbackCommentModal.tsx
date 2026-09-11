import React from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { AiFeedbackValue } from '@/services/feedback/feedbackStorage';

interface FeedbackCommentModalProps {
    visible: boolean;
    value: AiFeedbackValue;
    comment: string;
    onCommentChange: (comment: string) => void;
    onClose: () => void;
    onSubmit: () => void;
}

const SERIF = { fontFamily: 'PlayfairDisplayRegular' };

function titleFor(value: AiFeedbackValue): string {
    return value === 'up' ? 'What worked?' : 'What missed?';
}

function helperFor(value: AiFeedbackValue): string {
    return value === 'up'
        ? 'Save what Blackrose should do more often.'
        : 'Save what Blackrose should avoid next time.';
}

/** Quiet sheet: hairline field, serif heading, outlined verbs. No brand fills. */
export function FeedbackCommentModal({
    visible,
    value,
    comment,
    onCommentChange,
    onClose,
    onSubmit,
}: FeedbackCommentModalProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const iconColor = isDark ? Colors.dark.text : Colors.light.text;
    const placeholderColor = isDark ? Colors.dark.tabIconDefault : Colors.light.tabIconDefault;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View className="flex-1 justify-end bg-black/50">
                <View className="rounded-t-sheet border-t border-hairline-light bg-surface-light px-6 pb-8 pt-3 dark:border-hairline-dark dark:bg-surface-dark">
                    <View className="mb-5 h-1 w-10 self-center rounded-full bg-hairline-light dark:bg-hairline-dark" />

                    <View className="flex-row items-start justify-between gap-3">
                        <Text
                            className="flex-1 text-[24px] leading-[32px] text-text-light dark:text-text-dark"
                            style={SERIF}
                        >
                            {titleFor(value)}
                        </Text>
                        <Pressable
                            onPress={onClose}
                            className="min-h-11 min-w-11 items-center justify-center"
                            accessibilityRole="button"
                            accessibilityLabel="Close feedback"
                        >
                            <MaterialIcons name="close" size={24} color={iconColor} />
                        </Pressable>
                    </View>

                    <Text className="mt-1.5 text-[15px] leading-[22px] text-text-secondary-light dark:text-text-secondary-dark">
                        {helperFor(value)}
                    </Text>

                    <TextInput
                        value={comment}
                        onChangeText={onCommentChange}
                        placeholder="Add a note about tone, pacing, or wording..."
                        placeholderTextColor={placeholderColor}
                        multiline
                        className="mt-5 min-h-28 rounded-control border border-hairline-light bg-surface-light p-4 text-[16px] text-text-light dark:border-hairline-dark dark:bg-surface-dark dark:text-text-dark"
                    />

                    <View className="mt-6 flex-row justify-end gap-4">
                        <Pressable
                            onPress={onClose}
                            accessibilityRole="button"
                            accessibilityLabel="Cancel feedback"
                            className="min-h-12 items-center justify-center rounded-control border border-hairline-light px-6 dark:border-hairline-dark"
                        >
                            <Text className="text-[16px] text-text-secondary-light dark:text-text-secondary-dark">
                                Cancel
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={onSubmit}
                            accessibilityRole="button"
                            accessibilityLabel="Save feedback"
                            className="min-h-12 items-center justify-center rounded-control border border-bone-light px-7 dark:border-bone-dark"
                        >
                            <Text
                                className="text-[17px] text-text-light dark:text-text-dark"
                                style={SERIF}
                            >
                                Save
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
