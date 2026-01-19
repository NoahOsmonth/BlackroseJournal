/**
 * FAB (Floating Action Button) Component
 * Pink edit button for creating new journal entries
 * Matches journal-history.html design
 */

import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';

interface FABProps {
    onPress?: () => void;
}

export function FAB({ onPress }: FABProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    return (
        <View className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40">
            <Pressable
                onPress={onPress}
                className="bg-primary active:bg-primary-dark rounded-full p-4 shadow-fab"
                style={{
                    borderWidth: 4,
                    borderColor: isDark ? '#121212' : '#F5F5F7',
                }}
            >
                <Ionicons name="pencil" size={28} color="#FFFFFF" />
            </Pressable>
        </View>
    );
}
