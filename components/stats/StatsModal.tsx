/**
 * Base Stats Modal Component
 * Reusable modal wrapper for stat detail views
 */

import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

interface StatsModalProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

export function StatsModal({ visible, onClose, title, children }: StatsModalProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/50" onTouchEnd={onClose}>
                <View
                    className="flex-1 mt-20 bg-background-light dark:bg-background-dark rounded-t-3xl"
                    onTouchEnd={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <View className="flex-row items-center justify-between px-6 py-4 border-b border-divider-light dark:border-divider-dark">
                        <Text className="text-xl font-bold text-text-main-light dark:text-text-main-dark">
                            {title}
                        </Text>
                        <Pressable
                            onPress={onClose}
                            accessibilityLabel="Close modal"
                            accessibilityRole="button"
                            hitSlop={8}
                            className="p-2 -mr-2"
                        >
                            <MaterialIcons
                                name="close"
                                size={24}
                                color={isDark ? '#A0A0A0' : '#757575'}
                            />
                        </Pressable>
                    </View>

                    {/* Content */}
                    <ScrollView
                        className="flex-1 px-6 py-4"
                        showsVerticalScrollIndicator={false}
                    >
                        {children}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}
