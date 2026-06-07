import React from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

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

function titleFor(value: AiFeedbackValue): string {
    return value === 'up' ? 'What worked?' : 'What missed?';
}

function helperFor(value: AiFeedbackValue): string {
    return value === 'up'
        ? 'Save what Rosebud should do more often.'
        : 'Save what Rosebud should avoid next time.';
}

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
                <View className="rounded-t-[28px] bg-surface-light dark:bg-surface-dark p-5">
                    <View className="flex-row items-center justify-between">
                        <Text className="text-lg font-bold text-text-light dark:text-white">
                            {titleFor(value)}
                        </Text>
                        <Pressable
                            onPress={onClose}
                            className="p-2"
                            accessibilityRole="button"
                            accessibilityLabel="Close feedback"
                        >
                            <MaterialIcons name="close" size={22} color={iconColor} />
                        </Pressable>
                    </View>

                    <Text className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                        {helperFor(value)}
                    </Text>

                    <TextInput
                        value={comment}
                        onChangeText={onCommentChange}
                        placeholder="Add a note about tone, pacing, or wording..."
                        placeholderTextColor={placeholderColor}
                        multiline
                        className="mt-4 min-h-28 rounded-2xl border border-divider-light dark:border-divider-dark p-4 text-base text-text-light dark:text-white"
                    />

                    <View className="mt-5 flex-row justify-end gap-3">
                        <Pressable
                            onPress={onClose}
                            accessibilityRole="button"
                            accessibilityLabel="Cancel feedback"
                            className="rounded-full px-4 py-3"
                        >
                            <Text className="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                                Cancel
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={onSubmit}
                            accessibilityRole="button"
                            accessibilityLabel="Save feedback"
                            className="rounded-full bg-primary px-5 py-3"
                        >
                            <Text className="text-sm font-bold text-white">Save</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
