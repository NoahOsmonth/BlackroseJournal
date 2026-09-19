import React, { useMemo } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import { clipNoteText, formatLedgerDate, themesForText, titleCaseTheme } from './memoryDisplay';

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
    // Prototype `.write-keep` fills with `--accent-strong` and inks with `--bg`.
    // `accent-strong` is the high-contrast companion to the bone accent (the
    // plan's "Primary CTA fill contrast"); `bone-*` is the *interactive* accent
    // and renders this commit action as a mid-brown mark. It has no Tailwind
    // token yet, so it is read from the locked palette the same way the dock's
    // write control is. Promote to a token when `tailwind.config.js` is free.
    const keepFill = isDark ? BLACKROSE_PALETTE.dark.accentStrong : BLACKROSE_PALETTE.light.accentStrong;
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
                    /* The input carries the page's rule — "search becomes a rule
                       you write on". It inks from hairline to full text once
                       there is something on it (the prototype's `is-active`). */
                    className={`min-h-[84px] border-b pb-2 text-[16px] leading-6 text-text-light dark:text-text-dark ${
                        hasText
                            ? 'border-text-light dark:border-text-dark'
                            : 'border-hairline-light dark:border-hairline-dark'
                    }`}
                    accessibilityLabel="New line"
                />

                {hasText ? (
                    <View className="gap-1">
                        <Text className="text-[11px] uppercase tracking-[1.5px] text-text-secondary-light dark:text-text-secondary-dark">
                            Filed under
                        </Text>
                        {/* Live region: a screen-reader user hears the themes
                            update, and hears the "nothing recognised" branch
                            rather than silence. */}
                        <Text
                            className="text-sm text-text-secondary-light dark:text-text-secondary-dark"
                            accessibilityLiveRegion="polite"
                        >
                            {themes.length > 0
                                ? themes.slice(0, 4).map(titleCaseTheme).join(' · ')
                                : 'Nothing recognised — it will be kept as written'}
                        </Text>
                    </View>
                ) : null}

                <View className="flex-row items-center justify-between gap-3">
                    <Pressable
                        onPress={onKeep}
                        disabled={!canKeep}
                        accessibilityRole="button"
                        accessibilityLabel="Keep this note"
                        accessibilityState={{ disabled: !canKeep }}
                        className="rounded-control border border-transparent px-4 py-2"
                        style={({ pressed }) => [
                            { backgroundColor: keepFill, opacity: !canKeep ? 0.35 : pressed ? 0.7 : 1 },
                        ]}
                    >
                        {/* Prototype inks the CTA with `var(--bg)` — the page
                            colour — which is exactly what the runtime
                            `background-*` tokens hold. */}
                        <Text className="text-sm text-background-light dark:text-background-dark">
                            {isSaving ? 'Keeping…' : 'Keep it'}
                        </Text>
                    </Pressable>
                    {/* The on-screen restatement of the no-AI, no-network promise
                        this surface makes: nothing here leaves the device. */}
                    <Text
                        className="text-xs text-text-secondary-light dark:text-text-secondary-dark"
                        numberOfLines={1}
                    >
                        Stays on this device.
                    </Text>
                </View>
            </View>
        </View>
    );
}
