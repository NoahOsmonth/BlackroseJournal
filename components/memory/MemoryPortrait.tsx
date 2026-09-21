import React from 'react';
import { Text, View } from 'react-native';

import type { LocalMemoryAtom } from '@/services/memory/localMemory.types';
import {
    memoryPortraitProse,
    profilePreview,
    topMemoryThemes,
} from './memoryDisplay';
import { ThemeDriftStrip } from './ThemeDriftStrip';

interface MemoryPortraitProps {
    atoms: readonly LocalMemoryAtom[];
    onThemePress: (tag: string) => void;
}

export function MemoryPortrait({ atoms, onThemePress }: MemoryPortraitProps) {
    const about = profilePreview(atoms);
    // Notes included: a note is now a first-class memory the writer chose to
    // keep, so excluding them meant someone who only writes on Explore saw no
    // themes at all (see `topMemoryThemes`).
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

            {/* The themes drift slowly past the reader — the page's only looping
                motion, and the only element saying the list is longer than the
                frame. */}
            {themes.length > 0 ? (
                <ThemeDriftStrip themes={themes} onThemePress={onThemePress} />
            ) : null}
        </View>
    );
}
