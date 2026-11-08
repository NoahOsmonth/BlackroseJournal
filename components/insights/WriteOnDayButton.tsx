/**
 * One plain-language door to write on a day shown in a calendar. Shared by the
 * month grid and the year grid so the two can never disagree about the route,
 * the empty-day copy, or which days are writable. Copy describes what the
 * writer does, not how the date is stored.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const SECONDARY = 'text-text-secondary-light dark:text-text-secondary-dark';

interface WriteOnDayButtonProps {
    readonly dateKey: string;
    readonly canWrite: boolean;
    readonly hasWriting: boolean;
}

export function WriteOnDayButton({ dateKey, canWrite, hasWriting }: WriteOnDayButtonProps) {
    const isDark = useColorScheme() === 'dark';
    const ink = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;
    const label = hasWriting ? 'Add another note for this day' : 'Write about this day';
    return (
        <View className="mt-4">
            {!hasWriting ? (
                <Text className={'text-[15px] ' + SECONDARY} testID="write-on-day-empty">
                    Nothing written on this day.
                </Text>
            ) : null}
            {canWrite ? (
                <Pressable
                    onPress={() => router.push({ pathname: '/chat', params: { writeOn: dateKey } })}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    testID="write-on-day-button"
                    className="mt-4 min-h-11 flex-row items-center justify-center gap-2 rounded-control border border-hairline-light bg-surface-light px-4 dark:border-hairline-dark dark:bg-surface-dark"
                >
                    <MaterialIcons name="edit" size={18} color={ink} />
                    <Text className="text-[15px] text-text-light dark:text-text-dark">{label}</Text>
                </Pressable>
            ) : null}
        </View>
    );
}
