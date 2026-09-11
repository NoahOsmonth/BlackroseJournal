/**
 * Streaks & achievements.
 *
 * The concept (black-rose-rewards.png) is one giant serif numeral, a hairline-
 * flanked "Longest · N" line, then a hairline-divided achievement list with a
 * sage medallion per row. No emoji, no flame badge, no progress bars.
 */

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RewardsSkeleton } from '@/components/rewards/RewardsSkeleton';
import { StaggerEntranceItem } from '@/components/ui/StaggerEntrance';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AchievementProgress, useAchievements } from '@/hooks/useAchievements';

const HAIRLINE = 'border-hairline-light dark:border-hairline-dark';

interface AchievementRowProps {
    item: AchievementProgress;
    onPress: () => void;
}

/** One achievement: sage medallion, serif title, state on the right, chevron. */
function AchievementRow({ item, onPress }: AchievementRowProps) {
    const isDark = useColorScheme() === 'dark';
    const unlockedGlyph = isDark ? BLACKROSE_PALETTE.dark.bg : BLACKROSE_PALETTE.light.surface;
    const chevronColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;

    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`${item.achievement.title}, ${item.isUnlocked ? 'unlocked' : 'locked'}`}
            className="min-h-16 flex-row items-center gap-4 px-4 py-3.5"
        >
            <View
                className={
                    item.isUnlocked
                        ? 'h-11 w-11 items-center justify-center rounded-full bg-ok-light dark:bg-ok-dark'
                        : `h-11 w-11 items-center justify-center rounded-full border ${HAIRLINE}`
                }
            >
                <MaterialIcons
                    name={item.achievement.icon as keyof typeof MaterialIcons.glyphMap}
                    size={20}
                    color={item.isUnlocked ? unlockedGlyph : chevronColor}
                />
            </View>

            <Text
                className="min-w-0 flex-1 text-[17px] text-text-light dark:text-text-dark"
                style={{ fontFamily: 'PlayfairDisplayRegular' }}
                numberOfLines={2}
            >
                {item.achievement.title}
            </Text>

            <Text className="text-[15px] text-text-secondary-light dark:text-text-secondary-dark">
                {item.isUnlocked ? 'Unlocked' : 'Locked'}
            </Text>
            <MaterialIcons name="chevron-right" size={20} color={chevronColor} />
        </Pressable>
    );
}

export default function RewardsScreen() {
    const router = useRouter();
    const isDark = useColorScheme() === 'dark';
    const ink = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;
    const { achievements, currentStreak, longestStreak } = useAchievements();

    const [selectedAchievement, setSelectedAchievement] = useState<AchievementProgress | null>(null);
    // Achievements are computed synchronously today, but keep a hydration gate so a
    // skeleton shows instantly if they ever load remotely.
    const [isHydrating, setIsHydrating] = useState(true);
    React.useEffect(() => {
        setIsHydrating(false);
    }, []);

    const handleBack = () => {
        router.back();
    };

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="w-full max-w-md flex-1 self-center">
                <View className="flex-row items-center px-6 py-4">
                    <Pressable
                        onPress={handleBack}
                        className="h-10 w-10 items-center justify-center"
                        hitSlop={8}
                        accessibilityLabel="Go back"
                        accessibilityRole="button"
                    >
                        <MaterialIcons name="arrow-back" size={24} color={ink} />
                    </Pressable>
                    <Text
                        className="flex-1 text-center text-[22px] text-text-light dark:text-text-dark"
                        style={{ fontFamily: 'PlayfairDisplayRegular' }}
                    >
                        Streaks
                    </Text>
                    <View className="w-10" />
                </View>

                <View className="h-px w-full bg-hairline-light dark:bg-hairline-dark" />

                <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
                    {isHydrating ? (
                        <RewardsSkeleton />
                    ) : (
                        <>
                            {/* The one enormous serif numeral, then the state it names. */}
                            <View className="items-center pt-10 pb-8">
                                <Text
                                    className="text-[96px] leading-[104px] text-text-light dark:text-text-dark"
                                    style={{ fontFamily: 'PlayfairDisplayRegular' }}
                                >
                                    {currentStreak}
                                </Text>
                                <Text
                                    className="text-[19px] text-text-secondary-light dark:text-text-secondary-dark"
                                    style={{ fontFamily: 'PlayfairDisplayRegular' }}
                                >
                                    day streak
                                </Text>

                                <View className="mt-8 w-full flex-row items-center gap-4">
                                    <View className="h-px flex-1 bg-hairline-light dark:bg-hairline-dark" />
                                    <Text
                                        className="text-[16px] text-text-secondary-light dark:text-text-secondary-dark"
                                        style={{ fontFamily: 'PlayfairDisplayRegular' }}
                                    >
                                        Longest · {longestStreak}
                                    </Text>
                                    <View className="h-px flex-1 bg-hairline-light dark:bg-hairline-dark" />
                                </View>
                            </View>

                            <Text
                                className="mb-4 text-[22px] text-text-light dark:text-text-dark"
                                style={{ fontFamily: 'PlayfairDisplayRegular' }}
                            >
                                Achievements
                            </Text>

                            <View className={`overflow-hidden rounded-card border ${HAIRLINE}`}>
                                {achievements.map((item, index) => (
                                    <StaggerEntranceItem
                                        key={item.achievement.id}
                                        index={index}
                                        columns={1}
                                        totalItems={achievements.length}
                                        staggerType="linear"
                                        baseDelayMs={25}
                                        delayFactorMs={35}
                                        className="w-full"
                                    >
                                        {index > 0 ? (
                                            <View className={`h-px w-full ${isDark ? 'bg-hairline-dark' : 'bg-hairline-light'}`} />
                                        ) : null}
                                        <AchievementRow
                                            item={item}
                                            onPress={() => setSelectedAchievement(item)}
                                        />
                                    </StaggerEntranceItem>
                                ))}
                            </View>

                            <View className="items-center pt-10 pb-12">
                                <View className="h-px w-full bg-hairline-light dark:bg-hairline-dark" />
                                <Text
                                    className="mt-6 text-center text-[17px] text-text-secondary-light dark:text-text-secondary-dark"
                                    style={{ fontFamily: 'PlayfairDisplayRegular', fontStyle: 'italic' }}
                                >
                                    Keep going gently.
                                </Text>
                            </View>
                        </>
                    )}
                </ScrollView>

                <Modal
                    visible={!!selectedAchievement}
                    animationType="fade"
                    transparent
                    onRequestClose={() => setSelectedAchievement(null)}
                >
                    <View
                        className="flex-1 items-center justify-center bg-black/50 p-6"
                        onTouchEnd={() => setSelectedAchievement(null)}
                    >
                        {selectedAchievement && (
                            <View
                                className={`w-full max-w-sm gap-4 rounded-sheet border bg-surface-light p-6 dark:bg-surface-dark ${HAIRLINE}`}
                                onTouchEnd={(e) => e.stopPropagation()}
                            >
                                <View className="items-center">
                                    <View
                                        className={
                                            selectedAchievement.isUnlocked
                                                ? 'h-14 w-14 items-center justify-center rounded-full bg-ok-light dark:bg-ok-dark'
                                                : `h-14 w-14 items-center justify-center rounded-full border ${HAIRLINE}`
                                        }
                                    >
                                        <MaterialIcons
                                            name={selectedAchievement.achievement.icon as keyof typeof MaterialIcons.glyphMap}
                                            size={26}
                                            color={selectedAchievement.isUnlocked
                                                ? (isDark ? BLACKROSE_PALETTE.dark.bg : BLACKROSE_PALETTE.light.surface)
                                                : (isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2)}
                                        />
                                    </View>
                                </View>
                                <Text
                                    className="text-center text-[22px] text-text-light dark:text-text-dark"
                                    style={{ fontFamily: 'PlayfairDisplayRegular' }}
                                >
                                    {selectedAchievement.achievement.title}
                                </Text>
                                <Text className="text-center text-[15px] leading-6 text-text-secondary-light dark:text-text-secondary-dark">
                                    {selectedAchievement.achievement.description}
                                </Text>
                                <View className="items-center">
                                    <Text className="text-[15px] text-text-secondary-light dark:text-text-secondary-dark">
                                        {selectedAchievement.isUnlocked
                                            ? 'Unlocked'
                                            : `${Math.round(selectedAchievement.progress * 100)}% complete`}
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>
                </Modal>
            </View>
        </SafeAreaView>
    );
}
