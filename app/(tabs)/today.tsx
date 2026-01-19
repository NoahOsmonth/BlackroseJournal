/**
 * Today Screen - Placeholder
 * Will be implemented with daily check-in functionality
 */

import { BottomNav, FAB } from '@/components/journal';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TodayScreen() {
    const router = useRouter();

    const handleNewEntry = () => {
        router.push('/chat');
    };

    const handleTabPress = (tab: 'today' | 'explore' | 'entries' | 'settings') => {
        if (tab !== 'today') {
            router.push(`/(tabs)/${tab}`);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full items-center justify-center">
                <Text className="text-2xl font-bold text-text-light dark:text-text-dark mb-2">
                    Today
                </Text>
                <Text className="text-subtext-light dark:text-subtext-dark">
                    Coming soon...
                </Text>
                <FAB onPress={handleNewEntry} />
                <BottomNav activeTab="today" onTabPress={handleTabPress} />
            </View>
        </SafeAreaView>
    );
}
