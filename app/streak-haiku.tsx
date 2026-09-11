/**
 * Streak haiku — a quiet celebration sheet. One serif numeral, then the
 * haiku as three standing lines in the companion's voice. No flame, no
 * filled brand CTA (see `black-rose-rewards.png` language).
 */

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StreakHaikuSkeleton } from '@/components/streak/StreakHaikuSkeleton';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useStreakHaiku } from '@/hooks/useStreakHaiku';

type StreakHaikuParams = {
    entryId?: string;
};

const SERIF = { fontFamily: 'PlayfairDisplayRegular' };

export default function StreakHaikuScreen() {
    const router = useRouter();
    const isDark = useColorScheme() === 'dark';
    const params = useLocalSearchParams<StreakHaikuParams>();

    const entryId = useMemo(() => {
        const raw = params.entryId;
        return Array.isArray(raw) ? raw[0] : raw;
    }, [params.entryId]);

    const { streakCount, lines, isLoading, error } = useStreakHaiku(entryId);

    const handleExit = () => {
        router.replace('/(tabs)/today');
    };

    const ink = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;

    // This screen is shown right after finishing an entry, so we expect a non-zero streak.
    // Clamp defensively to avoid timezone edge-cases.
    const displayStreak = Math.max(streakCount, 1);
    const dayLabel = displayStreak === 1 ? 'day' : 'days';

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="mx-auto w-full max-w-md flex-1">
                <View className="flex-row items-center justify-between px-5 py-4">
                    <View className="min-h-11 min-w-11" />
                    <Text
                        className="text-[26px] leading-[34px] text-text-light dark:text-text-dark"
                        style={SERIF}
                    >
                        Streak
                    </Text>
                    <Pressable
                        onPress={handleExit}
                        className="-mr-2 min-h-11 min-w-11 items-center justify-center"
                        accessibilityLabel="Close"
                    >
                        <MaterialIcons name="close" size={26} color={ink} />
                    </Pressable>
                </View>

                <View className="flex-1 px-6">
                    <View className="mt-6 items-center">
                        <Text
                            className="text-[76px] leading-[88px] text-text-light dark:text-text-dark"
                            style={SERIF}
                        >
                            {displayStreak}
                        </Text>
                        <Text className="-mt-1 text-[15px] uppercase tracking-[2px] text-text-secondary-light dark:text-text-secondary-dark">
                            {dayLabel} streak
                        </Text>
                    </View>

                    <View className="mt-10 rounded-card border border-hairline-light bg-surface-light p-6 dark:border-hairline-dark dark:bg-surface-dark">
                        {isLoading && <StreakHaikuSkeleton />}

                        {!isLoading && error && (
                            <>
                                <Text
                                    className="text-[21px] leading-[29px] text-text-light dark:text-text-dark"
                                    style={SERIF}
                                >
                                    Couldn’t load haiku
                                </Text>
                                <Text className="mt-2 text-[15px] leading-[23px] text-text-secondary-light dark:text-text-secondary-dark">
                                    {error}
                                </Text>
                            </>
                        )}

                        {!isLoading && !error && lines && (
                            <>
                                <Text className="text-[12px] uppercase tracking-[1.5px] text-text-secondary-light dark:text-text-secondary-dark">
                                    Your haiku
                                </Text>
                                <Text
                                    className="mt-4 text-[20px] leading-[34px] text-text-light dark:text-text-dark"
                                    style={SERIF}
                                >
                                    {lines[0]}
                                    {'\n'}
                                    {lines[1]}
                                    {'\n'}
                                    {lines[2]}
                                </Text>

                                <View className="mt-5 flex-row items-center justify-end">
                                    <Pressable
                                        onPress={() => { }}
                                        className="min-h-11 min-w-11 items-center justify-center"
                                        accessibilityLabel="Share haiku"
                                    >
                                        <MaterialIcons name="share" size={20} color={ink} />
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
                            className="min-h-[52px] items-center justify-center rounded-control border border-bone-light dark:border-bone-dark"
                        >
                            <Text
                                className="text-[18px] text-text-light dark:text-text-dark"
                                style={SERIF}
                            >
                                Continue
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
}
