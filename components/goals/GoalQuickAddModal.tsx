import React, { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

interface GoalQuickAddModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (title: string, type: 'goal' | 'habit') => void;
}

export function GoalQuickAddModal({ visible, onClose, onSubmit }: GoalQuickAddModalProps) {
    const [title, setTitle] = useState('');
    const [type, setType] = useState<'goal' | 'habit'>('goal');

    const handleSave = () => {
        if (!title.trim()) return;
        onSubmit(title.trim(), type);
        setTitle('');
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View className="flex-1 bg-black/50 justify-end" onTouchEnd={onClose}>
                <View
                    className="bg-surface-light dark:bg-surface-dark rounded-t-3xl p-6"
                    onTouchEnd={(e) => e.stopPropagation()}
                >
                    <Text className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">
                        Add a goal
                    </Text>
                    <View className="flex-row gap-3 mb-4">
                        <Pressable
                            onPress={() => setType('goal')}
                            className={`flex-1 py-2 rounded-full border ${type === 'goal'
                                ? 'border-primary bg-primary/10'
                                : 'border-divider-light dark:border-divider-dark'
                                }`}
                        >
                            <Text className={`text-center text-sm font-medium ${type === 'goal'
                                ? 'text-primary'
                                : 'text-text-secondary-light dark:text-text-secondary-dark'
                                }`}>
                                Goal
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setType('habit')}
                            className={`flex-1 py-2 rounded-full border ${type === 'habit'
                                ? 'border-primary bg-primary/10'
                                : 'border-divider-light dark:border-divider-dark'
                                }`}
                        >
                            <Text className={`text-center text-sm font-medium ${type === 'habit'
                                ? 'text-primary'
                                : 'text-text-secondary-light dark:text-text-secondary-dark'
                                }`}>
                                Habit
                            </Text>
                        </Pressable>
                    </View>
                    <TextInput
                        value={title}
                        onChangeText={setTitle}
                        placeholder="What do you want to do?"
                        placeholderTextColor="#9CA3AF"
                        className="bg-background-light dark:bg-background-dark rounded-2xl px-4 py-3 text-text-light dark:text-text-dark"
                    />
                    <View className="flex-row gap-3 mt-5">
                        <Pressable
                            onPress={onClose}
                            className="flex-1 py-3 rounded-2xl items-center border border-divider-light dark:border-divider-dark"
                        >
                            <Text className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
                                Cancel
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={handleSave}
                            className="flex-1 py-3 rounded-2xl items-center bg-text-light dark:bg-white"
                        >
                            <Text className="text-sm font-semibold text-white dark:text-black">Save</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
