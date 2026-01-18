/**
 * Journal Header Component
 * Sticky header with gift icon, "Journal" title, and menu button
 * Matches journal-history.html design
 */

import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

interface JournalHeaderProps {
    onMenuPress?: () => void;
    onGiftPress?: () => void;
}

export function JournalHeader({ onMenuPress, onGiftPress }: JournalHeaderProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    return (
        <View
            className="bg-surface-light/95 dark:bg-surface-dark/95 border-b border-divider-light dark:border-divider-dark px-4 py-3 flex-row items-center justify-between"
        >
            <Pressable
                onPress={onGiftPress}
                className="p-2 -ml-2"
            >
                <MaterialIcons
                    name="card-giftcard"
                    size={24}
                    color={isDark ? '#8E8E93' : '#8E8E93'}
                />
            </Pressable>

            <Text className="text-lg font-bold tracking-tight text-text-light dark:text-text-dark">
                Journal
            </Text>

            <Pressable
                onPress={onMenuPress}
                className="p-2 -mr-2"
            >
                <MaterialIcons
                    name="menu"
                    size={24}
                    color={isDark ? '#E5E5E7' : '#1C1C1E'}
                />
            </Pressable>
        </View>
    );
}
