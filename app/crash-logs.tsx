import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useEffect } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingStatus } from '@/components/ui/LoadingStatus';
import { notifyUser, webConfirm } from '@/components/ui/webConfirm';
import { downloadTextFile } from '@/components/ui/webDownload';
import { APP_REPO_URL } from '@/constants/appInfo';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useCrashLogs } from '@/hooks/crash/useCrashLogs';
import { useNavBack } from '@/hooks/navigation/useNavBack';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { CrashLogRecord } from '@/services/crash/crashLogStorage';
import {
    buildCrashIssueUrl,
    buildCrashReportText,
    formatCrashTime,
} from '@/services/crash/crashReport';

type ActionIcon = 'content-copy' | 'file-download' | 'bug-report';

interface ActionButtonProps {
    readonly label: string;
    readonly icon: ActionIcon;
    readonly onPress: () => void;
    readonly primary?: boolean;
}

function ActionButton({ label, icon, onPress, primary = false }: ActionButtonProps) {
    const isDark = useColorScheme() === 'dark';
    // Ink on a solid bone fill: the page surface tone in each scheme, which is
    // exactly what the `on-bone-*` classes paint.
    const iconColor = primary
        ? (isDark ? BLACKROSE_PALETTE.dark.surface : BLACKROSE_PALETTE.light.surface)
        : (isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text);
    const chrome = primary
        ? 'border-bone-light bg-bone-light dark:border-bone-dark dark:bg-bone-dark'
        : 'border-hairline-light bg-surface-light dark:border-hairline-dark dark:bg-surface-dark';
    const text = primary
        ? 'text-on-bone-light dark:text-on-bone-dark'
        : 'text-text-light dark:text-text-dark';

    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            className={`min-h-12 flex-row items-center justify-center gap-2 rounded-control border px-4 active:opacity-80 ${chrome}`}
        >
            <MaterialIcons name={icon} size={18} color={iconColor} />
            <Text className={`text-[15px] ${text}`}>{label}</Text>
        </Pressable>
    );
}

interface CrashLogCardProps {
    readonly record: CrashLogRecord;
    readonly onCopy: (record: CrashLogRecord) => void;
}

function CrashLogCard({ record, onCopy }: CrashLogCardProps) {
    const isDark = useColorScheme() === 'dark';
    const iconColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;
    const meta = [
        formatCrashTime(record.createdAt),
        record.platform,
        `v${record.appVersion}`,
        record.component,
    ].join(' · ');

    return (
        <View className="gap-2 rounded-card border border-hairline-light bg-surface-light p-4 dark:border-hairline-dark dark:bg-surface-dark">
            <View className="flex-row items-start gap-3">
                <Text
                    className="min-w-0 flex-1 text-[15px] leading-[22px] text-text-light dark:text-text-dark"
                    numberOfLines={4}
                >
                    {record.message}
                </Text>
                <Pressable
                    onPress={() => onCopy(record)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Copy this crash log"
                    className="min-h-11 min-w-11 items-center justify-center"
                >
                    <MaterialIcons name="content-copy" size={18} color={iconColor} />
                </Pressable>
            </View>
            <Text className="text-[12px] leading-[18px] text-text-secondary-light dark:text-text-secondary-dark">
                {meta}
            </Text>
            {record.stack ? (
                <Text
                    className="text-[11px] leading-[16px] text-ink-2-light dark:text-ink-2-dark"
                    numberOfLines={8}
                >
                    {record.stack}
                </Text>
            ) : null}
        </View>
    );
}

export default function CrashLogsScreen() {
    const goBack = useNavBack('/(tabs)/settings');
    const isDark = useColorScheme() === 'dark';
    const { records, unseenCount, isLoading, error, markSeen, clear } = useCrashLogs();
    const iconColor = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;
    const dangerColor = isDark ? BLACKROSE_PALETTE.dark.danger : BLACKROSE_PALETTE.light.danger;
    const exportLabel = Platform.OS === 'web' ? 'Download' : 'Share';

    // Opening this screen is what "seeing" a crash means.
    useEffect(() => {
        if (!isLoading && unseenCount > 0) {
            void markSeen();
        }
    }, [isLoading, markSeen, unseenCount]);

    const handleCopyAll = useCallback(async () => {
        await Clipboard.setStringAsync(buildCrashReportText(records));
        notifyUser('Copied', 'The crash logs are on your clipboard.');
    }, [records]);

    const handleCopyOne = useCallback((record: CrashLogRecord) => {
        void Clipboard.setStringAsync(buildCrashReportText([record])).then(() => {
            notifyUser('Copied', 'That crash log is on your clipboard.');
        });
    }, []);

    const handleExport = useCallback(async () => {
        const text = buildCrashReportText(records);
        const day = new Date().toISOString().slice(0, 10);
        if (downloadTextFile(`blackrose-crash-logs-${day}.txt`, text, 'text/plain')) {
            return;
        }
        try {
            await Share.share({ message: text, title: 'Blackrose crash logs' });
        } catch (cause) {
            notifyUser(
                'Export failed',
                cause instanceof Error ? cause.message : 'Could not share the crash logs.',
            );
        }
    }, [records]);

    const handleReport = useCallback(async () => {
        try {
            await Linking.openURL(buildCrashIssueUrl(records));
        } catch {
            notifyUser(
                'Could not open GitHub',
                `Open ${APP_REPO_URL}/issues to report this manually.`,
            );
        }
    }, [records]);

    const runClear = useCallback(async () => {
        try {
            await clear();
            notifyUser('Crash logs cleared');
        } catch (cause) {
            notifyUser(
                'Clear failed',
                cause instanceof Error ? cause.message : 'Could not clear the crash logs.',
            );
        }
    }, [clear]);

    const handleClear = useCallback(() => {
        const message = 'Delete the stored crash logs from this device? This cannot be undone.';
        const webAnswer = webConfirm(message);
        if (webAnswer === false) {
            return;
        }
        if (webAnswer === true) {
            void runClear();
            return;
        }

        Alert.alert('Clear crash logs', message, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => { void runClear(); } },
        ]);
    }, [runClear]);

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full">
                <View className="flex-row items-center justify-between px-4 py-4">
                    <Pressable
                        onPress={goBack}
                        className="-ml-2 min-h-11 min-w-11 items-center justify-center"
                        accessibilityLabel="Back"
                        accessibilityRole="button"
                    >
                        <MaterialIcons name="arrow-back" size={26} color={iconColor} />
                    </Pressable>
                    <Text
                        className="text-[26px] leading-[34px] text-text-light dark:text-text-dark"
                        style={{ fontFamily: 'PlayfairDisplayRegular' }}
                    >
                        Crash logs
                    </Text>
                    <View className="w-10" />
                </View>

                {isLoading ? (
                    <View className="flex-1 items-center justify-center px-6">
                        <LoadingStatus label="Loading crash logs" detail="Reading this device only." />
                    </View>
                ) : error ? (
                    <View className="flex-1 items-center justify-center px-6">
                        <EmptyState
                            icon="error-outline"
                            title="Could not read crash logs"
                            message={error}
                        />
                    </View>
                ) : records.length === 0 ? (
                    <View className="flex-1 items-center justify-center px-6">
                        <EmptyState
                            icon="check-circle-outline"
                            title="No crashes recorded"
                            message="If the app ever closes unexpectedly, the next launch will keep the details here so you can copy or download them."
                        />
                    </View>
                ) : (
                    <ScrollView
                        className="flex-1"
                        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
                        showsVerticalScrollIndicator={false}
                    >
                        <View className="gap-4">
                            <Text className="text-[13px] leading-[20px] text-text-secondary-light dark:text-text-secondary-dark">
                                Stored on this device only. Nothing is uploaded until you choose to
                                report it.
                            </Text>

                            <View className="flex-row flex-wrap gap-3">
                                <ActionButton
                                    label="Copy logs"
                                    icon="content-copy"
                                    primary
                                    onPress={() => { void handleCopyAll(); }}
                                />
                                <ActionButton
                                    label={exportLabel}
                                    icon="file-download"
                                    onPress={() => { void handleExport(); }}
                                />
                                <ActionButton
                                    label="Report on GitHub"
                                    icon="bug-report"
                                    onPress={() => { void handleReport(); }}
                                />
                            </View>

                            {records.map((record) => (
                                <CrashLogCard
                                    key={record.id}
                                    record={record}
                                    onCopy={handleCopyOne}
                                />
                            ))}

                            <Pressable
                                onPress={handleClear}
                                accessibilityRole="button"
                                accessibilityLabel="Clear crash logs"
                                className="mt-2 min-h-12 flex-row items-center justify-center gap-2 rounded-control border border-hairline-light active:opacity-80 dark:border-hairline-dark"
                            >
                                <MaterialIcons name="delete-outline" size={18} color={dangerColor} />
                                <Text className="text-[15px] text-danger-light dark:text-danger-dark">
                                    Clear crash logs
                                </Text>
                            </Pressable>
                        </View>
                    </ScrollView>
                )}
            </View>
        </SafeAreaView>
    );
}
