import React from 'react';
import { Text, View } from 'react-native';

interface EmotionData {
    emotion: string;
    score: number;
    emoji: string;
}

interface EmotionalLandscapeChartProps {
    data: EmotionData[];
    /** Kept for call-site compatibility; the rail carries no emoji. */
    emojiStyle?: 'native' | 'minimal' | 'flat' | '3d';
}

const MAX_SCORE = 10;

/**
 * Mood as a quiet rail, per black-rose-insights.png: a hairline track with one
 * filled dot per emotion and the emotion named beneath its dot. No bar chart,
 * no emoji — the concept reads as a measurement, not a dashboard.
 */
export function EmotionalLandscapeChart({ data }: EmotionalLandscapeChartProps) {
    const scored = (data ?? []).filter((item) => item.score > 0).slice(0, 2);

    if (scored.length === 0) {
        return (
            <View className="py-2">
                <View className="h-px w-full bg-hairline-light dark:bg-hairline-dark" />
                <Text className="mt-3 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    Not enough data
                </Text>
            </View>
        );
    }

    return (
        <View>
            {/* The rail is taller than the dots so each dot can sit on the
                hairline without clipping; dots are absolutely placed by score. */}
            <View className="h-8 justify-center">
                <View className="h-px w-full bg-hairline-light dark:bg-hairline-dark" />
                {scored.map((item) => {
                    const pct = Math.min(Math.max(item.score / MAX_SCORE, 0), 1) * 100;
                    return (
                        <View
                            key={item.emotion}
                            className="absolute h-2.5 w-2.5 rounded-full bg-bone-light dark:bg-bone-dark"
                            style={{ left: `${pct}%`, marginLeft: -5 }}
                            accessibilityLabel={`${item.emotion} ${item.score} of ${MAX_SCORE}`}
                        />
                    );
                })}
            </View>

            {/* Labels sit beneath the rail: the low end left, the high end right. */}
            <View className="mt-3 flex-row justify-between">
                <Text className="text-[15px] text-text-secondary-light dark:text-text-secondary-dark">
                    {scored[0].emotion}
                </Text>
                {scored[1] ? (
                    <Text className="text-[15px] text-text-secondary-light dark:text-text-secondary-dark">
                        {scored[1].emotion}
                    </Text>
                ) : null}
            </View>
        </View>
    );
}
