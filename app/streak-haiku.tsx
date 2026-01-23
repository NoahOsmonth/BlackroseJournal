/**
 * Streak Haiku Screen (Modal)
 * (Task 003) Celebrates the user's current streak with an AI-generated haiku.
 */

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useStreakHaiku } from '@/hooks/useStreakHaiku';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type StreakHaikuParams = {
    entryId?: string;
};

export default function StreakHaikuScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const params = useLocalSearchParams<StreakHaikuParams>();

    const entryId = useMemo(() => {
        const raw = params.entryId;
        return Array.isArray(raw) ? raw[0] : raw;
    }, [params.entryId]);

    const { streakCount, lines, isLoading, error } = useStreakHaiku(entryId);

    const handleExit = () => {
        router.replace('/(tabs)/today');
    };

    // This screen is shown right after finishing an entry, so we expect a non-zero streak.
    // Clamp defensively to avoid timezone edge-cases.
    const displayStreak = Math.max(streakCount, 1);
    const dayLabel = displayStreak === 1 ? 'DAY' : 'DAYS';

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full">
                <View className="flex-row items-center justify-between px-4 py-4">
                    <View className="w-10" />
                    <Text className="text-xl font-bold text-text-main-light dark:text-text-main-dark">
                        Streak
                    </Text>
                    <Pressable onPress={handleExit} className="p-2 -mr-2" accessibilityLabel="Close">
                        <MaterialIcons name="close" size={24} color={isDark ? '#E5E5E7' : '#1C1C1E'} />
                    </Pressable>
                </View>

                <View className="flex-1 px-6">
                    <View className="items-center mt-6">
                        <Text className="text-[56px] font-bold text-primary">
                            {displayStreak}
                        </Text>
                        <Text className="text-sm font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide -mt-1">
                            {dayLabel} STREAK
                        </Text>
                    </View>

                    <View className="mt-8 p-6 rounded-2xl bg-surface-light dark:bg-surface-dark">
                        {isLoading && (
                            <View className="items-center">
                                <ActivityIndicator size="small" color="#E91E63" />
                                <Text className="mt-3 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                                    Writing your haiku…
                                </Text>
                            </View>
                        )}

                        {!isLoading && error && (
                            <>
                                <Text className="text-base font-semibold text-text-main-light dark:text-text-main-dark">
                                    Couldn’t load haiku
                                </Text>
                                <Text className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                                    {error}
                                </Text>
                            </>
                        )}

                        {!isLoading && !error && lines && (
                            <>
                                <Text className="text-lg font-bold text-text-main-light dark:text-text-main-dark mb-4">
                                    Your haiku
                                </Text>
                                <Text className="text-base leading-7 text-text-main-light dark:text-text-main-dark">
                                    {lines[0]}{"\n"}{lines[1]}{"\n"}{lines[2]}
                                </Text>

                                <View className="flex-row items-center justify-end mt-4">
                                    <Pressable
                                        onPress={() => { }}
                                        className="p-2"
                                        accessibilityLabel="Share haiku"
                                    >
                                        <MaterialIcons
                                            name="share"
                                            size={20}
                                            color={isDark ? '#E5E5E7' : '#1C1C1E'}
                                        />
                                    </Pressable>
                                </View>
                            </>
                        )}
                    </View>

                    <View className="flex-1" />

                    <View className="pb-8">
                        <Pressable
                            onPress={handleExit}
                            accessibilityLabel="Continue"
                            className="py-4 rounded-2xl items-center justify-center bg-primary"
                        >
                            <Text className="text-[15px] font-bold text-white">Continue</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
}
