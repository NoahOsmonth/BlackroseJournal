import React from 'react';
import { Pressable, Text, View } from 'react-native';

import type { LocalMemoryAtom } from '@/services/memory/localMemory.types';
import {
    memoryPortraitProse,
    profilePreview,
    topMemoryThemes,
} from './memoryDisplay';

interface MemoryPortraitProps {
    atoms: readonly LocalMemoryAtom[];
    onThemePress: (tag: string) => void;
}

/** Concept chips are title-case words, not extraction tokens ("calm" → "Calm"). */
function titleCase(theme: string): string {
    return theme.replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

export function MemoryPortrait({ atoms, onThemePress }: MemoryPortraitProps) {
    const about = profilePreview(atoms);
    const themes = topMemoryThemes(atoms, 4);
    const prose = memoryPortraitProse(atoms);

    return (
        <View className="gap-5">
            <View className="gap-2">
                <Text
                    className="text-[22px] text-text-light dark:text-text-dark"
                    style={{ fontFamily: 'PlayfairDisplayRegular' }}
                >
                    About you
                </Text>
                {about ? (
                    /* The concept sets the portrait in serif — it reads as prose
                       about the writer, not as UI copy. */
                    <Text
                        className="text-[16px] leading-7 text-text-light dark:text-text-dark"
                        style={{ fontFamily: 'PlayfairDisplayRegular' }}
                    >
                        {about}
                    </Text>
                ) : (
                    <Text className="text-sm leading-relaxed text-text-secondary-light dark:text-text-secondary-dark">
                        As you finish journal entries, Blackrose builds a private portrait of what
                        matters.
                    </Text>
                )}
                <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                    {prose}
                </Text>
            </View>

            {themes.length > 0 ? (
                <View className="flex-row flex-wrap gap-2">
                    {themes.map((theme) => (
                        <Pressable
                            key={theme}
                            onPress={() => onThemePress(theme)}
                            className="rounded-control border border-hairline-light bg-surface-light px-3.5 py-2 dark:border-hairline-dark dark:bg-surface-dark"
                            accessibilityRole="button"
                            accessibilityLabel={`Filter memory by ${theme}`}
                            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                        >
                            <Text
                                className="text-[15px] text-text-light dark:text-text-dark"
                                style={{ fontFamily: 'PlayfairDisplayRegular' }}
                            >
                                {titleCase(theme)}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            ) : null}
        </View>
    );
}
