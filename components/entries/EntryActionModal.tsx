/**
 * Entry Action Modal Component
 * Shows options when tapping an entry: Continue Entry, Create New, Cancel
 */

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

interface EntryActionModalProps {
    visible: boolean;
    onClose: () => void;
    onContinue: () => void;
    onNewEntry: () => void;
    entryTitle?: string;
}

export function EntryActionModal({
    visible,
    onClose,
    onContinue,
    onNewEntry,
    entryTitle,
}: EntryActionModalProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const primaryColor = useThemeColor({}, 'primary');

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/50 justify-end" onTouchEnd={onClose}>
                <View
                    className={`rounded-t-3xl p-6 ${isDark ? 'bg-surface-dark' : 'bg-surface-light'}`}
                    onTouchEnd={(e) => e.stopPropagation()}
                >
                    {/* Title */}
                    {entryTitle && (
                        <Text
                            className="text-lg font-bold text-text-main-light dark:text-text-main-dark mb-4 text-center"
                            numberOfLines={2}
                        >
                            {entryTitle}
                        </Text>
                    )}

                    {/* Continue Entry */}
                    <Pressable
                        onPress={onContinue}
                        accessibilityLabel="Continue Entry"
                        accessibilityRole="button"
                        className={`flex-row items-center p-4 rounded-xl mb-3 ${isDark ? 'bg-background-dark' : 'bg-background-light'
                            }`}
                    >
                        <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-3">
                            <MaterialIcons name="edit" size={20} color={primaryColor} />
                        </View>
                        <View className="flex-1">
                            <Text className="text-base font-bold text-text-main-light dark:text-text-main-dark">
                                Continue Entry
                            </Text>
                            <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                                Add more to this reflection
                            </Text>
                        </View>
                        <MaterialIcons
                            name="chevron-right"
                            size={24}
                            color={isDark ? '#666' : '#999'}
                        />
                    </Pressable>

                    {/* Create New Entry */}
                    <Pressable
                        onPress={onNewEntry}
                        accessibilityLabel="Create New Entry"
                        accessibilityRole="button"
                        className={`flex-row items-center p-4 rounded-xl mb-3 ${isDark ? 'bg-background-dark' : 'bg-background-light'
                            }`}
                    >
                        <View className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 items-center justify-center mr-3">
                            <MaterialIcons name="add" size={20} color="#3B82F6" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-base font-bold text-text-main-light dark:text-text-main-dark">
                                Create New Entry
                            </Text>
                            <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                                Start a fresh reflection
                            </Text>
                        </View>
                        <MaterialIcons
                            name="chevron-right"
                            size={24}
                            color={isDark ? '#666' : '#999'}
                        />
                    </Pressable>

                    {/* Cancel */}
                    <Pressable
                        onPress={onClose}
                        accessibilityLabel="Cancel"
                        accessibilityRole="button"
                        className="p-4 rounded-xl items-center"
                    >
                        <Text className="text-base font-bold text-text-secondary-light dark:text-text-secondary-dark">
                            Cancel
                        </Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}
