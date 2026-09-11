import React from 'react';
import { Text, View } from 'react-native';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const BAR_MAX = 72;
/** A day with words keeps a visible minimum; an empty day draws nothing. */
const BAR_MIN = 8;

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
    const ceiling = Math.max(maxWords, 1);
    const line = proseLine(words, entries, dailyWords);

    return (
        <View
            className="rounded-card border border-hairline-light dark:border-hairline-dark bg-surface-light dark:bg-surface-dark overflow-hidden"
            accessibilityLabel={line}
        >
            <View className="px-5 pt-5">
                <Text
                    className="text-[16px] text-text-light dark:text-text-dark"
                    style={{ fontFamily: 'PlayfairDisplayRegular' }}
                >
                    Writing stats
                </Text>
            </View>

            {/* Two big numbers, divided by a hairline, closed by a full-bleed rule. */}
            <View className="mt-4 flex-row">
                <View className="flex-1 items-center pb-4">
                    <Text
                        className="text-[38px] leading-none text-text-light dark:text-text-dark"
                        style={{ fontFamily: 'PlayfairDisplayRegular' }}
                    >
                        {words.toLocaleString()}
                    </Text>
                    <Text className="mt-1 text-[14px] text-text-secondary-light dark:text-text-secondary-dark">
                        Words
                    </Text>
                </View>
                <View className="w-px bg-hairline-light dark:bg-hairline-dark" />
                <View className="flex-1 items-center pb-4">
                    <Text
                        className="text-[38px] leading-none text-text-light dark:text-text-dark"
                        style={{ fontFamily: 'PlayfairDisplayRegular' }}
                    >
                        {entries}
                    </Text>
                    <Text className="mt-1 text-[14px] text-text-secondary-light dark:text-text-secondary-dark">
                        {entries === 1 ? 'Entry' : 'Entries'}
                    </Text>
                </View>
            </View>

            <View className="h-px w-full bg-hairline-light dark:bg-hairline-dark" />

            {/* Bars grow out of the chart's baseline rule. */}
            <View className="px-5 pt-4 pb-3">
                <View className="flex-row items-end justify-between">
                    <Text
                        className="text-[14px] text-text-light dark:text-text-dark"
                        style={{ fontFamily: 'PlayfairDisplayRegular' }}
                    >
                        Daily words
                    </Text>
                    <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                        Your week so far
                    </Text>
                </View>

                <View
                    className="mt-4 flex-row items-end justify-between gap-1"
                    style={{ height: BAR_MAX + 18 }}
                >
                    {dailyWords.map((count, index) => {
                        const ratio = count / ceiling;
                        const height = count > 0
                            ? Math.max(Math.round(ratio * BAR_MAX), BAR_MIN)
                            : 0;
                        const hasWords = count > 0;

                        return (
                            <View
                                key={DAY_NAMES[index]}
                                className="flex-1 items-center justify-end"
                                style={{ height: BAR_MAX + 18 }}
                            >
                                {hasWords ? (
                                    <View
                                        testID={`daily-words-bar-${index}`}
                                        accessibilityLabel={`${DAY_NAMES[index]} ${count} words`}
                                        className="w-3 bg-bone-light dark:bg-bone-dark"
                                        style={{ height }}
                                    />
                                ) : (
                                    <View
                                        testID={`daily-words-bar-${index}`}
                                        accessibilityLabel={`${DAY_NAMES[index]} 0 words`}
                                        style={{ height: 0 }}
                                    />
                                )}
                            </View>
                        );
                    })}
                </View>

                <View className="mt-2 h-px bg-hairline-light dark:bg-hairline-dark" />
                <View className="mt-2 flex-row items-center justify-between">
                    {DAY_LABELS.map((label, index) => (
                        <Text
                            key={`${label}-${index}`}
                            className="flex-1 text-center text-[12px] text-text-secondary-light dark:text-text-secondary-dark"
                        >
                            {label}
                        </Text>
                    ))}
                </View>
            </View>
        </View>
    );
}
