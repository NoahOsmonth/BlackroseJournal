/**
 * A small shelf of starting points under the Today writing card (Kaneo #13).
 *
 * For the writer who opened the app and had nothing ready. Each chip is a door:
 * tapping it opens the chat with that opening line already in the input, so it
 * can be edited, sent, or ignored. Nothing is written until they send.
 */

import React from 'react';
import { Pressable, ScrollView, Text } from 'react-native';

import type { GuidedPrompt } from '@/utils/guidedPrompts';

interface GuidedPromptShelfProps {
    /** The prompts to show, already chosen by the caller's hook. */
    readonly prompts: readonly GuidedPrompt[];
    readonly onPick: (prompt: GuidedPrompt) => void;
}

export function GuidedPromptShelf({ prompts, onPick }: GuidedPromptShelfProps) {
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
                    onPress={() => onPick(prompt)}
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
