import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';

const SERIF = { fontFamily: 'PlayfairDisplayRegular' };
const HAIRLINE = 'border-hairline-light dark:border-hairline-dark';

interface GoalEditModalProps {
    visible: boolean;
    /** Row being edited; null when the sheet is closed. */
    goal: { id: string; title: string; type: 'goal' | 'habit' } | null;
    onClose: () => void;
    onSave: (id: string, title: string) => void;
    onDelete: (id: string) => void;
}

/**
 * Edit sheet for an existing goal or habit: rename in place, delete with
 * confirm. Mirrors the quiet-sheet style of GoalQuickAddModal (serif title,
 * hairline controls, outlined verbs). Web confirm() keeps automation-friendly
 * destructive confirmation parity with settings rows.
 */
export function GoalEditModal({ visible, goal, onClose, onSave, onDelete }: GoalEditModalProps) {
    const [title, setTitle] = useState('');
    const isDark = useColorScheme() === 'dark';
    const insets = useSafeAreaInsets();

    const quietInk = isDark ? '#8A8580' : '#6B6560';

    useEffect(() => {
        if (visible && goal) {
            setTitle(goal.title);
        }
    }, [visible, goal]);

    const handleSave = () => {
        if (!goal || !title.trim()) return;
        onSave(goal.id, title.trim());
    };

    const handleDelete = () => {
        if (!goal) return;
        const confirmed =
            typeof window !== 'undefined' && typeof window.confirm === 'function'
                ? window.confirm(`Delete "${goal.title}"? This cannot be undone.`)
                : true;
        if (!confirmed) return;
        onDelete(goal.id);
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
                        Edit {goal?.type === 'habit' ? 'habit' : 'goal'}
                    </Text>

                    <TextInput
                        value={title}
                        onChangeText={setTitle}
                        placeholder="What do you want to do?"
                        placeholderTextColor={quietInk}
                        accessibilityLabel="Goal title"
                        className={`mt-4 min-h-12 rounded-control border ${HAIRLINE} px-4 py-3 text-[16px] text-text-light dark:text-text-dark`}
                        autoFocus
                    />

                    <View className="mt-6 flex-row gap-4">
                        <Pressable
                            onPress={handleDelete}
                            accessibilityRole="button"
                            accessibilityLabel="Delete goal"
                            className={`min-h-12 flex-1 items-center justify-center rounded-control border ${HAIRLINE}`}
                        >
                            <Text className="text-[16px] text-text-secondary-light dark:text-text-secondary-dark">
                                Delete
                            </Text>
                        </Pressable>
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
                            accessibilityLabel="Save changes"
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
