import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

interface HeaderProps {
    query: string;
    onQueryChange: (text: string) => void;
    onBack?: () => void;
}

export function MemoryGraphHeader({ query, onQueryChange, onBack }: HeaderProps) {
    const colorScheme = useColorScheme();
    const iconColor = colorScheme === 'dark' ? Colors.dark.text : Colors.light.icon;
    const placeholderColor = colorScheme === 'dark' ? Colors.dark.icon : Colors.light.icon;

    return (
        <View className="px-5 pt-3 pb-4 border-b border-divider-light dark:border-divider-dark">
            <View className="flex-row items-center gap-3">
                {onBack ? (
                    <Pressable
                        onPress={onBack}
                        accessibilityRole="button"
                        accessibilityLabel="Back from memory graph"
                        className="rounded-full bg-surface-light p-2 dark:bg-surface-dark"
                    >
                        <MaterialIcons name="arrow-back" size={20} color={iconColor} />
                    </Pressable>
                ) : null}
                <Text className="text-2xl font-bold text-text-light dark:text-text-dark">
                    Memory Graph
                </Text>
            </View>
            <View
                className="mt-3 flex-row items-center rounded-2xl border border-divider-light
                dark:border-divider-dark bg-surface-light dark:bg-surface-dark px-3"
            >
                <MaterialIcons name="search" size={18} color={iconColor} />
                <TextInput
                    accessibilityLabel="Search memory graph"
                    className="ml-2 flex-1 py-3 text-sm text-text-light dark:text-text-dark"
                    placeholder="Search memory node or keyword..."
                    placeholderTextColor={placeholderColor}
                    value={query}
                    onChangeText={onQueryChange}
                />
            </View>
        </View>
    );
}
