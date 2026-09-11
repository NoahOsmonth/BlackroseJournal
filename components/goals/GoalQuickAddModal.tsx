import React, { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';

interface GoalQuickAddModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (title: string, type: 'goal' | 'habit') => void;
}

const SERIF = { fontFamily: 'PlayfairDisplayRegular' };
const HAIRLINE = 'border-hairline-light dark:border-hairline-dark';

/** Quiet sheet: serif title, hairline segmented control, outlined verbs. */
export function GoalQuickAddModal({ visible, onClose, onSubmit }: GoalQuickAddModalProps) {
    const [title, setTitle] = useState('');
    const [type, setType] = useState<'goal' | 'habit'>('goal');
    const isDark = useColorScheme() === 'dark';
    const insets = useSafeAreaInsets();

    const quietInk = isDark ? '#8A8580' : '#6B6560';

    const handleSave = () => {
        if (!title.trim()) return;
        onSubmit(title.trim(), type);
        setTitle('');
    };

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
                    >
                        Add a goal
                    </Text>

                    <View className="mt-5 flex-row gap-3">
                        {(['goal', 'habit'] as const).map((option) => {
                            const active = type === option;
                            return (
                                <Pressable
                                    key={option}
                                    onPress={() => setType(option)}
                                    accessibilityRole="button"
                                    accessibilityLabel={option === 'goal' ? 'Goal' : 'Habit'}
                                    className={`min-h-12 flex-1 items-center justify-center rounded-control border ${
                                        active
                                            ? 'border-bone-light dark:border-bone-dark'
                                            : HAIRLINE
                                    }`}
                                >
                                    <Text
                                        className={
                                            active
                                                ? 'text-[16px] text-text-light dark:text-text-dark'
                                                : 'text-[15px] text-text-secondary-light dark:text-text-secondary-dark'
                                        }
                                    >
                                        {option === 'goal' ? 'Goal' : 'Habit'}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>

                    <TextInput
                        value={title}
                        onChangeText={setTitle}
                        placeholder="What do you want to do?"
                        placeholderTextColor={quietInk}
                        className={`mt-4 min-h-12 rounded-control border ${HAIRLINE} px-4 py-3 text-[16px] text-text-light dark:text-text-dark`}
                        autoFocus
                    />

                    <View className="mt-6 flex-row gap-4">
                        <Pressable
                            onPress={onClose}
                            accessibilityRole="button"
                            accessibilityLabel="Cancel"
                            className={`min-h-12 flex-1 items-center justify-center rounded-control border ${HAIRLINE}`}
                        >
                            <Text className="text-[16px] text-text-secondary-light dark:text-text-secondary-dark">
                                Cancel
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={handleSave}
                            accessibilityRole="button"
                            accessibilityLabel="Save"
                            className="min-h-12 flex-1 items-center justify-center rounded-control border border-bone-light dark:border-bone-dark"
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
