/**
 * Auth chrome shared by the four `(auth)` screens.
 *
 * Concept `black-rose-login.png`: chevron back, one serif hero line, a card
 * notched with the rose sprig, a hairline-and-rose rule before the secondary
 * action, and the BLACKROSE / JOURNAL wordmark at the foot of the page.
 */

import React from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { RoseMark } from '@/components/ui/RoseMark';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useAuthInk() {
    const isDark = useColorScheme() === 'dark';
    return {
        isDark,
        icon: isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text,
        muted: isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2,
        accent: isDark ? BLACKROSE_PALETTE.dark.accent : BLACKROSE_PALETTE.light.accent,
    };
}

/** Chevron + “Back” link, padded to a 44px touch target. */
export function AuthBackLink({ onPress }: { onPress: () => void }) {
    const ink = useAuthInk();

    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="-ml-2 min-h-11 flex-row items-center gap-1.5 self-start pr-3"
        >
            <MaterialIcons name="chevron-left" size={26} color={ink.icon} />
            <Text className="text-[17px] text-text-light dark:text-text-dark">Back</Text>
        </Pressable>
    );
}

/** The screen's single serif moment: 40px title plus one quiet line of context. */
export function AuthHeading({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <View className="mt-2 gap-3">
            <Text
                className="text-[40px] leading-[46px] text-text-light dark:text-text-dark"
                style={{ fontFamily: 'PlayfairDisplayRegular' }}
            >
                {title}
            </Text>
            <Text className="text-[15px] leading-[22px] text-text-secondary-light dark:text-text-secondary-dark">
                {subtitle}
            </Text>
        </View>
    );
}

/** Hairline — rose — hairline, the concept's divider above the secondary action. */
export function RoseRuleDivider() {
    const ink = useAuthInk();

    return (
        <View className="mt-5 flex-row items-center gap-3">
            <View className="h-px flex-1 bg-hairline-light dark:bg-hairline-dark" />
            <RoseMark size={20} color={ink.accent} strokeWidth={1.2} variant="sprig" />
            <View className="h-px flex-1 bg-hairline-light dark:bg-hairline-dark" />
        </View>
    );
}

/** BLACKROSE / JOURNAL lockup with a rose beneath, centred at the page foot. */
export function AuthWordmark() {
    const ink = useAuthInk();

    return (
        <View className="mt-10 items-center gap-2 pb-4">
            <Text className="text-[22px] tracking-[7px] text-text-light dark:text-text-dark">
                BLACKROSE
            </Text>
            <View className="flex-row items-center gap-3">
                <View className="h-px w-10 bg-hairline-light dark:bg-hairline-dark" />
                <Text className="text-[11px] tracking-[4px] text-text-secondary-light dark:text-text-secondary-dark">
                    JOURNAL
                </Text>
                <View className="h-px w-10 bg-hairline-light dark:bg-hairline-dark" />
            </View>
            <RoseMark size={24} color={ink.accent} strokeWidth={1.2} variant="sprig" />
        </View>
    );
}

/** The auth card, with the rose sprig notched into its top edge. */
export function AuthCard({ children }: { children: React.ReactNode }) {
    const ink = useAuthInk();

    return (
        <View className="mt-8">
            <View className="items-center">
                <RoseMark size={44} color={ink.accent} strokeWidth={1.1} variant="sprig" />
            </View>
            <View className="-mt-3 rounded-card border border-hairline-light bg-surface-light p-5 pt-8 dark:border-hairline-dark dark:bg-surface-dark">
                {children}
            </View>
        </View>
    );
}
