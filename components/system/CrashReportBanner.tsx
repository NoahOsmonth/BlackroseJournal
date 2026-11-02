import React from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';

import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCrashLogs } from '@/hooks/crash/useCrashLogs';

/**
 * Post-crash notice. Renders only when the store holds a crash the user has not
 * opened yet, so a quiet relaunch stays quiet.
 */
export function CrashReportBanner() {
    const router = useRouter();
    const isDark = useColorScheme() === 'dark';
    const { records, unseenCount, markSeen } = useCrashLogs();

    if (unseenCount === 0) return null;

    const iconColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;
    const count = records.length;
    const subtitle = count === 1
        ? '1 crash log is ready to copy'
        : `${count} crash logs are ready to copy`;

    return (
        <View className="flex-row items-center gap-3 rounded-card border border-hairline-light bg-surface-light px-4 py-3 dark:border-hairline-dark dark:bg-surface-dark">
            <Pressable
                onPress={() => router.push('/crash-logs')}
                accessibilityRole="button"
                accessibilityLabel="View crash logs"
                className="min-w-0 flex-1 flex-row items-center gap-3 active:opacity-80"
            >
                <View className="h-9 w-9 items-center justify-center rounded-full border border-hairline-light dark:border-hairline-dark">
                    <MaterialIcons name="report-problem" size={18} color={iconColor} />
                </View>
                <View className="min-w-0 flex-1">
                    <Text
                        className="text-[15px] text-text-light dark:text-text-dark"
                        numberOfLines={1}
                    >
                        The app closed unexpectedly
                    </Text>
                    <Text
                        className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark"
                        numberOfLines={1}
                    >
                        {subtitle}
                    </Text>
                </View>
            </Pressable>
            <Pressable
                onPress={() => { void markSeen(); }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Dismiss crash notice"
                className="min-h-11 min-w-11 items-center justify-center"
            >
                <MaterialIcons name="close" size={20} color={iconColor} />
            </Pressable>
        </View>
    );
}
