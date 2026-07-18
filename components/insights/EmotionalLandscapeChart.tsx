import React from 'react';
import { Text, View } from 'react-native';

interface EmotionData {
    emotion: string;
    score: number;
    emoji: string;
}

interface EmotionalLandscapeChartProps {
    data: EmotionData[];
    emojiStyle?: 'native' | 'minimal' | 'flat' | '3d';
}

export function EmotionalLandscapeChart({
    data,
    emojiStyle = 'native',
}: EmotionalLandscapeChartProps) {
    const maxScore = 10;

    if (!data || data.length === 0) {
        return (
            <View className="h-24 w-full items-center justify-center">
                <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    No emotional data yet
                </Text>
            </View>
        );
    }

    const topEmotions = data.filter((item) => item.score > 0).slice(0, 3);

    const renderEmoji = (emoji: string, hasScore: boolean) => {
        const opacityClass = hasScore ? 'opacity-90' : 'opacity-35';
        if (emojiStyle === 'flat') {
            return (
                <View
                    className={`h-7 w-7 items-center justify-center rounded-full bg-background-light dark:bg-background-dark ${opacityClass}`}
                >
                    <Text className="text-base">{emoji}</Text>
                </View>
            );
        }
        return <Text className={`text-lg ${opacityClass}`}>{emoji}</Text>;
    };

    return (
        <View>
            {topEmotions.length > 0 ? (
                <View className="mb-4 flex-row flex-wrap gap-2">
                    {topEmotions.map((item) => (
                        <View
                            key={item.emotion}
                            className="rounded-full bg-background-light dark:bg-background-dark px-3 py-1"
                        >
                            <Text className="text-xs font-medium text-text-light dark:text-text-dark">
                                {item.emotion}
                            </Text>
                        </View>
                    ))}
                </View>
            ) : null}

            <View className="relative h-32 w-full px-1">
                <View className="h-full flex-row items-end justify-between pb-1 pt-2">
                    {data.map((item) => {
                        const heightPct = Math.max((item.score / maxScore) * 72, item.score > 0 ? 8 : 4);
                        return (
                            <View
                                key={item.emotion}
                                className="h-full flex-1 flex-col items-center justify-end gap-2"
                            >
                                <View
                                    className={`w-2.5 rounded-full ${
                                        item.score > 0
                                            ? 'bg-text-secondary-light dark:bg-text-secondary-dark'
                                            : 'bg-divider-light dark:bg-divider-dark'
                                    }`}
                                    style={{ height: `${heightPct}%` }}
                                />
                                <View
                                    className="h-7 items-center justify-center"
                                    accessibilityLabel={item.emotion}
                                >
                                    {renderEmoji(item.emoji, item.score > 0)}
                                </View>
                            </View>
                        );
                    })}
                </View>
                <View className="absolute bottom-8 left-0 right-0 h-px bg-divider-light dark:bg-divider-dark" />
            </View>
        </View>
    );
}
