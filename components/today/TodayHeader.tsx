/**
 * TodayHeader Component
 * Header with gift icon (Rewards), date title, and menu icon (Settings)
 * Matches today.html design
 */

import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

interface TodayHeaderProps {
    /** Formatted date string, e.g., "Sunday, Jan 18th" */
    dateTitle: string;
}

export function TodayHeader({ dateTitle }: TodayHeaderProps) {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const handleGiftPress = () => {
        router.push('/rewards' as never);
    };

    const handleMenuPress = () => {
        router.push('/(tabs)/settings');
    };

    const iconColor = isDark ? '#A0A0A0' : '#757575';
    const menuColor = isDark ? '#E0E0E0' : '#333333';

    return (
        <View className="flex-row items-center justify-between px-6 py-4">
            <Pressable
                onPress={handleGiftPress}
                className="p-2 -ml-2"
                hitSlop={8}
                accessibilityLabel="Open rewards"
                accessibilityRole="button"
            >
                <MaterialIcons name="card-giftcard" size={24} color={iconColor} />
            </Pressable>

            <Text className="text-lg font-bold text-text-main-light dark:text-text-main-dark">
                {dateTitle}
            </Text>

            <Pressable
                onPress={handleMenuPress}
                className="p-2 -mr-2"
                hitSlop={8}
                accessibilityLabel="Open settings"
                accessibilityRole="button"
            >
                <MaterialIcons name="menu" size={24} color={menuColor} />
            </Pressable>
        </View>
    );
}
