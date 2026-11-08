/**
 * A small shelf of starting points under the Today writing card (Kaneo #13).
 *
 * For the writer who opened the app and had nothing ready. Each chip is a door:
 * tapping it opens the chat with that opening line already in the input, so it
 * can be edited, sent, or ignored. Nothing is written until they send.
 */

import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';

import { moodForHour, promptsForDay } from '@/utils/guidedPrompts';

interface GuidedPromptShelfProps {
    /** Local date key, so the shelf is stable for the day. */
    readonly todayKey: string;
    /** Hour of day used to pick prompts that fit the moment. */
    readonly hour: number;
    readonly onPick: (opening: string) => void;
}

export function GuidedPromptShelf({ todayKey, hour, onPick }: GuidedPromptShelfProps) {
    const prompts = useMemo(
        () => promptsForDay(todayKey, moodForHour(hour), 3),
        [todayKey, hour],
    );

    if (prompts.length === 0) return null;

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
            accessibilityLabel="Ways to start writing"
            testID="guided-prompt-shelf"
        >
            {prompts.map((prompt) => (
                <Pressable
                    key={prompt.id}
                    onPress={() => onPick(prompt.opening)}
                    accessibilityRole="button"
                    accessibilityLabel={`Start with: ${prompt.opening}`}
                    className="min-h-[44px] justify-center rounded-full border border-hairline-light dark:border-hairline-dark px-4"
                    testID={`guided-prompt-${prompt.id}`}
                >
                    <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                        {prompt.label}
                    </Text>
                </Pressable>
            ))}
        </ScrollView>
    );
}
