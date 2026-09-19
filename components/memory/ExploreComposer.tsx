import React, { useMemo } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import { clipNoteText } from '@/services/memory/exploreNote';
import { formatLedgerDate, themesForText } from './memoryDisplay';

interface ExploreComposerProps {
    value: string;
    onChangeText: (value: string) => void;
    onKeep: () => void;
    isSaving: boolean;
    /** Injected for tests; defaults to Date.now(). */
    now?: number;
}

/**
 * The page's primary action. Writing here is free-form journaling with no AI in
 * the loop: nothing is sent anywhere, and the only feedback is the date column
 * and the themes the note will be filed under — both derived locally.
 *
 * There is deliberately no Refresh and no "Keep this as a note": this *is* the
 * note, and there is nothing to recompute.
 */
export function ExploreComposer({ value, onChangeText, onKeep, isSaving, now }: ExploreComposerProps) {
    const isDark = useColorScheme() === 'dark';
    const placeholderColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;
    const date = formatLedgerDate(now ?? Date.now());
    // Preview from the same clipped value the write path files — a token past
    // the 600-char cut would otherwise be promised here and never stored.
    const themes = useMemo(() => themesForText(clipNoteText(value)), [value]);
    // Raw value, not the clipped one: an all-whitespace note clips to '', but it
    // still has to show the "Filed under" block and admit it found nothing.
    const hasText = value.trim().length > 0;
    const canKeep = hasText && !isSaving;

    return (
        <View className="flex-row gap-4">
            {/* Month over day, serif, in the margin — how a printed ledger dates
                a continuation. These are write dates, never event dates. */}
            <View className="w-11 items-end pt-1">
                <Text
                    className="text-[13px] uppercase tracking-[1px] text-text-secondary-light dark:text-text-secondary-dark"
                >
                    {date.month}
                </Text>
                <Text
                    className="text-[22px] leading-7 text-text-light dark:text-text-dark"
                    style={{ fontFamily: 'PlayfairDisplayRegular' }}
                >
                    {date.day}
                </Text>
            </View>

            <View className="min-w-0 flex-1 gap-3">
                <Text className="text-[11px] uppercase tracking-[1.5px] text-text-secondary-light dark:text-text-secondary-dark">
                    New line
                </Text>
                <TextInput
                    value={value}
                    onChangeText={onChangeText}
                    placeholder="Write it plainly. No one is reading it."
                    placeholderTextColor={placeholderColor}
                    multiline
                    textAlignVertical="top"
                    className="min-h-[84px] text-[16px] leading-6 text-text-light dark:text-text-dark"
                    accessibilityLabel="New note"
                />

                {hasText ? (
                    <View className="gap-1 border-t border-hairline-light pt-3 dark:border-hairline-dark">
                        <Text className="text-[11px] uppercase tracking-[1.5px] text-text-secondary-light dark:text-text-secondary-dark">
                            Filed under
                        </Text>
                        <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                            {themes.length > 0
                                ? themes.slice(0, 4).join(' · ')
                                : 'Nothing recognised — it will be kept as written'}
                        </Text>
                    </View>
                ) : null}

                <View className="flex-row justify-end">
                    <Pressable
                        onPress={onKeep}
                        disabled={!canKeep}
                        accessibilityRole="button"
                        accessibilityLabel="Keep this note"
                        accessibilityState={{ disabled: !canKeep }}
                        className="rounded-control border border-hairline-light px-4 py-2 dark:border-hairline-dark"
                        style={({ pressed }) => [{ opacity: !canKeep ? 0.4 : pressed ? 0.7 : 1 }]}
                    >
                        <Text className="text-sm text-text-light dark:text-text-dark">
                            {isSaving ? 'Keeping…' : 'Keep'}
                        </Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );
}
