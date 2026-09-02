import MaterialIcons from '@expo/vector-icons/MaterialIcons';
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
    const isDark = colorScheme === 'dark';
    const iconColor = isDark ? Colors.dark.text : Colors.light.icon;
    const placeholderColor = isDark ? Colors.dark.icon : Colors.light.icon;

    return (
        <View className="border-b border-divider-light px-5 pb-4 pt-3 dark:border-divider-dark">
            <View className="flex-row items-center gap-3">
                {onBack ? (
                    <Pressable
                        onPress={onBack}
                        accessibilityRole="button"
                        accessibilityLabel="Back from memory graph"
                        className="h-10 w-10 items-center justify-center rounded-2xl
                        border border-divider-light bg-surface-light
                        dark:border-divider-dark dark:bg-surface-dark"
                    >
                        <MaterialIcons name="arrow-back" size={20} color={iconColor} />
                    </Pressable>
                ) : null}
                <View className="min-w-0 flex-1">
                    <Text
                        className="text-2xl font-bold text-text-light dark:text-text-dark"
                        style={{ fontFamily: 'PlayfairDisplayBold' }}
                    >
                        Memory map
                    </Text>
                    <Text className="mt-0.5 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                        Your inner constellation
                    </Text>
                </View>
            </View>
            <View
                className="mt-3.5 flex-row items-center rounded-2xl border border-divider-light
                bg-surface-light px-3.5 dark:border-divider-dark dark:bg-surface-dark"
            >
                <MaterialIcons name="search" size={18} color={iconColor} />
                <TextInput
                    accessibilityLabel="Search memory graph"
                    className="ml-2 flex-1 py-3 text-sm text-text-light dark:text-text-dark"
                    placeholder="Search stars, themes, keywords…"
                    placeholderTextColor={placeholderColor}
                    value={query}
                    onChangeText={onQueryChange}
                    returnKeyType="search"
                    clearButtonMode="while-editing"
                />
            </View>
        </View>
    );
}
