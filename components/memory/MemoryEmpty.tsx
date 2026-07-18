import React from 'react';
import { Pressable, Text, View } from 'react-native';

interface MemoryEmptyProps {
    onWritePress: () => void;
}

export function MemoryEmpty({ onWritePress }: MemoryEmptyProps) {
    return (
        <View
            className="items-center px-6 py-12"
            accessibilityLabel="Your memory grows as you journal"
        >
            <Text
                className="text-center text-2xl font-bold text-text-light dark:text-text-dark"
                style={{ fontFamily: 'PlayfairDisplayBold' }}
            >
                Still quiet here
            </Text>
            <Text className="mt-2 max-w-xs text-center text-sm leading-relaxed text-text-secondary-light dark:text-text-secondary-dark">
                Rosebud builds private context from finished entries and notes you pin.
            </Text>
            <Pressable
                onPress={onWritePress}
                className="mt-6 rounded-full bg-primary px-5 py-2.5 dark:bg-primary-dark"
                accessibilityRole="button"
                accessibilityLabel="Write your first entry"
                style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
            >
                <Text className="text-sm font-bold text-white dark:text-gray-900">
                    Write your first entry
                </Text>
            </Pressable>
        </View>
    );
}
