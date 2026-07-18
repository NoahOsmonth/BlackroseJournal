import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

const UNLOCK_AT = 5;

interface InsightsWeekLetterProps {
    isUnlocked: boolean;
    entriesCount: number;
    weeklySummary?: string;
    onWritePress: () => void;
}

function ProgressMarks({ filled, total }: { filled: number; total: number }) {
    return (
        <View className="flex-row items-center gap-2" accessibilityLabel={`${filled} of ${total} entries`}>
            {Array.from({ length: total }, (_, index) => {
                const done = index < filled;
                return (
                    <View
                        key={index}
                        className={`h-1.5 flex-1 rounded-full ${
                            done
                                ? 'bg-primary dark:bg-primary-dark'
                                : 'bg-divider-light dark:bg-divider-dark'
                        }`}
                    />
                );
            })}
        </View>
    );
}

export function InsightsWeekLetter({
    isUnlocked,
    entriesCount,
    weeklySummary,
    onWritePress,
}: InsightsWeekLetterProps) {
    const remaining = Math.max(0, UNLOCK_AT - entriesCount);
    const summary = weeklySummary?.trim() ?? '';
    const hasLetter = isUnlocked
        && summary.length > 0
        && summary !== 'No entries yet this week.';

    if (hasLetter) {
        return (
            <View
                className="rounded-2xl border border-divider-light dark:border-divider-dark bg-surface-light dark:bg-surface-dark px-5 py-5"
                accessibilityLabel="This week's letter"
            >
                <Text className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                    This week&apos;s letter
                </Text>
                <Text
                    className="mt-3 text-[16px] leading-7 text-text-light dark:text-text-dark"
                    style={{ fontFamily: 'PlayfairDisplayRegular' }}
                >
                    {summary}
                </Text>
            </View>
        );
    }

    const handleWrite = () => {
        if (Platform.OS !== 'web') {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onWritePress();
    };

    return (
        <View
            className="rounded-2xl border border-divider-light dark:border-divider-dark bg-surface-light dark:bg-surface-dark px-5 py-6"
            accessibilityLabel={`This week's letter locked. ${entriesCount} of ${UNLOCK_AT} entries.`}
        >
            <Text
                className="text-xl font-bold text-text-light dark:text-text-dark"
                style={{ fontFamily: 'PlayfairDisplayBold' }}
            >
                This week&apos;s letter
            </Text>
            <Text className="mt-2 text-sm leading-relaxed text-text-secondary-light dark:text-text-secondary-dark">
                A private summary of themes, moods, and people once you&apos;ve written enough this week.
            </Text>

            <View className="mt-5">
                <ProgressMarks filled={Math.min(entriesCount, UNLOCK_AT)} total={UNLOCK_AT} />
                <Text className="mt-3 text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
                    {entriesCount >= UNLOCK_AT
                        ? 'Letter is ready when analysis finishes.'
                        : `${entriesCount} of ${UNLOCK_AT} · write ${remaining} more`}
                </Text>
            </View>

            {entriesCount < UNLOCK_AT ? (
                <Pressable
                    onPress={handleWrite}
                    className="mt-5 self-start rounded-full bg-primary px-4 py-2.5 dark:bg-primary-dark"
                    accessibilityRole="button"
                    accessibilityLabel="Write an entry"
                    style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
                >
                    <Text className="text-sm font-bold text-white dark:text-gray-900">
                        Write an entry
                    </Text>
                </Pressable>
            ) : null}
        </View>
    );
}

export const INSIGHTS_UNLOCK_AT = UNLOCK_AT;
