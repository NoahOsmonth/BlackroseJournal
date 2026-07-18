import React from 'react';
import { Text, View } from 'react-native';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const BAR_MAX = 72;
const BAR_MIN = 4;

interface InsightsWritingPresenceProps {
    words: number;
    entries: number;
    dailyWords: number[];
    maxWords: number;
}

function proseLine(words: number, entries: number, dailyWords: number[]): string {
    const activeDays = dailyWords.filter((count) => count > 0).length;
    const entryWord = entries === 1 ? 'entry' : 'entries';
    const dayWord = activeDays === 1 ? 'day' : 'days';
    if (entries === 0 && words === 0) {
        return 'No writing yet this week';
    }
    const wordPart = words > 0 ? `${words.toLocaleString()} words · ` : '';
    return `${wordPart}${entries} ${entryWord} · ${activeDays} ${dayWord}`;
}

export function InsightsWritingPresence({
    words,
    entries,
    dailyWords,
    maxWords,
}: InsightsWritingPresenceProps) {
    const todayIndex = new Date().getDay();
    const ceiling = Math.max(maxWords, 1);
    const line = proseLine(words, entries, dailyWords);

    return (
        <View
            className="rounded-2xl border border-divider-light dark:border-divider-dark bg-surface-light dark:bg-surface-dark px-4 py-4"
            accessibilityLabel={line}
        >
            <Text className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                Writing this week
            </Text>
            <Text className="mt-1 text-sm font-medium text-text-light dark:text-text-dark">
                {line}
            </Text>

            <View className="mt-4 flex-row items-end justify-between gap-1" style={{ height: BAR_MAX + 20 }}>
                {dailyWords.map((count, index) => {
                    const ratio = count / ceiling;
                    const height = count > 0
                        ? Math.max(Math.round(ratio * BAR_MAX), BAR_MIN)
                        : BAR_MIN;
                    const isToday = index === todayIndex;
                    const hasWords = count > 0;

                    return (
                        <View key={DAY_NAMES[index]} className="flex-1 items-center gap-1.5">
                            <View
                                className="w-full items-center justify-end"
                                style={{ height: BAR_MAX }}
                            >
                                <View
                                    testID={`daily-words-bar-${index}`}
                                    accessibilityLabel={`${DAY_NAMES[index]} ${count} words`}
                                    className={`w-2 rounded-full ${
                                        isToday
                                            ? 'bg-primary dark:bg-primary-dark'
                                            : hasWords
                                                ? 'bg-text-secondary-light/70 dark:bg-text-secondary-dark/70'
                                                : 'bg-divider-light dark:bg-divider-dark'
                                    }`}
                                    style={{ height }}
                                />
                            </View>
                            <Text
                                className={`text-[10px] font-semibold ${
                                    isToday
                                        ? 'text-primary dark:text-primary-dark'
                                        : 'text-text-secondary-light dark:text-text-secondary-dark'
                                }`}
                            >
                                {DAY_LABELS[index]}
                            </Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}
