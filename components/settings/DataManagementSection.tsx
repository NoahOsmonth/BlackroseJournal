import React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDriveBackup } from '@/hooks/backup/useDriveBackup';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import type { LocalBackupManifest } from '@/services/backup/localBackup';
import { SettingsSection } from './SettingsSection';

interface DataManagementSectionProps {
    readonly latestBackup: LocalBackupManifest | null;
    readonly isBusy: boolean;
    readonly isClearingHistory?: boolean;
    readonly onCreateBackup: () => void;
    readonly onRestoreLatestBackup: () => void;
    readonly onExportJournalJson: () => void;
    /** Dev-only: omit or no-op in production builds. */
    readonly onSeedDemoData?: () => void;
    /** Dev-only: bulk ~365 probe journal entries for prompt-budget. */
    readonly onSeedBulkProbe?: () => void;
    /** Dev-only: remove tracked seed IDs only. */
    readonly onClearDemoData?: () => void;
    /** Dev-only: row progress while a demo seed runs. */
    readonly seedProgress?: { readonly completed: number; readonly total: number } | null;
    readonly showDemoSeedControls?: boolean;
    readonly onClearHistory: () => void;
    readonly embedded?: boolean;
    /** True while any data operation (incl. a demo seed) is in flight. */
    readonly isSeeding?: boolean;
}

const HAIRLINE = 'border-hairline-light dark:border-hairline-dark';

interface SettingsRowProps {
    readonly label: string;
    readonly detail?: string;
    readonly destructive?: boolean;
    readonly disabled?: boolean;
    readonly showBorder?: boolean;
    readonly onPress: () => void;
}

/** One data row: label + detail on the left, chevron right, hairline between. */
function SettingsRow({
    label,
    detail,
    destructive = false,
    disabled = false,
    showBorder = true,
    onPress,
}: SettingsRowProps) {
    const isDark = useColorScheme() === 'dark';
    const chevronColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;
    const textClass = destructive
        ? 'text-[16px] text-danger-light dark:text-danger-dark'
        : 'text-[16px] text-text-light dark:text-text-dark';

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            className={`min-h-12 flex-row items-center justify-between gap-3 py-3.5 ${
                showBorder ? `border-b ${HAIRLINE}` : ''
            } ${disabled ? 'opacity-50' : ''}`}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
        >
            <View className="min-w-0 flex-1">
                <Text className={textClass}>{label}</Text>
                {detail ? (
                    <Text className="mt-1 text-[13px] leading-5 text-text-secondary-light dark:text-text-secondary-dark">
                        {detail}
                    </Text>
                ) : null}
            </View>
            <MaterialIcons name="chevron-right" size={20} color={chevronColor} />
        </Pressable>
    );
}

export function DataManagementSection({
    latestBackup,
    isBusy,
    isClearingHistory = false,
    onCreateBackup,
    onRestoreLatestBackup,
    onExportJournalJson,
    onSeedDemoData,
    onSeedBulkProbe,
    onClearDemoData,
    seedProgress = null,
    showDemoSeedControls = false,
    onClearHistory,
    embedded = false,
    isSeeding = false,
}: DataManagementSectionProps) {
    const latestLabel = latestBackup ? `Latest: ${latestBackup.name}` : 'No local backup yet';
    const showSeed = showDemoSeedControls && typeof onSeedDemoData === 'function';
    const showBulk = showDemoSeedControls && typeof onSeedBulkProbe === 'function';
    const showClearDemo = showDemoSeedControls && typeof onClearDemoData === 'function';
    const drive = useDriveBackup();
    const driveBusy = drive.status === 'busy';
    const driveDetail = drive.status === 'not-configured'
        ? 'Set EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID to enable.'
        : drive.detail ?? 'Manual backup file in your Drive app folder.';

    const handleDriveBackup = () => {
        void drive.backupNow().then((message) => {
            Alert.alert(message ? 'Drive backup done' : 'Drive backup', message ?? 'Google Drive backup failed.');
        });
    };

    const handleDriveRestore = () => {
        void drive.restoreLatest().then((message) => {
            Alert.alert(message ? 'Drive restore done' : 'Drive restore', message ?? 'Google Drive restore failed.');
        });
    };

    return (
        <SettingsSection title="Data Management" embedded={embedded}>
            <SettingsRow
                label="Create local backup"
                detail="Saves journal, goals, intentions, insights, personas, and settings on this device."
                disabled={isBusy}
                onPress={onCreateBackup}
            />
            <SettingsRow
                label="Restore latest backup"
                detail={latestLabel}
                disabled={isBusy || !latestBackup}
                onPress={onRestoreLatestBackup}
            />
            <SettingsRow
                label="Export journal JSON"
                detail="Shares a plain JSON export of journal entries only."
                disabled={isBusy}
                onPress={onExportJournalJson}
            />
            {showSeed ? (
                <SettingsRow
                    label="Seed demo data"
                    detail={seedProgress
                        ? `Seeding… ${seedProgress.completed}/${seedProgress.total} rows`
                        : 'Dev only. Adds sample journals/intentions without wiping real rows; replaces prior seed.'}
                    disabled={isBusy || isSeeding}
                    onPress={onSeedDemoData}
                />
            ) : null}
            {showBulk ? (
                <SettingsRow
                    label="Seed 365 probe entries"
                    detail="Dev only. Bulk journals + day digests for prompt-budget (tracked, clearable)."
                    disabled={isBusy}
                    onPress={onSeedBulkProbe}
                />
            ) : null}
            {showClearDemo ? (
                <SettingsRow
                    label="Clear demo data"
                    detail="Dev only. Removes tracked seed IDs only — real user rows stay."
                    disabled={isBusy}
                    onPress={onClearDemoData}
                />
            ) : null}
            <SettingsRow
                label="Back up memory to Google Drive"
                detail={driveDetail}
                disabled={isBusy || driveBusy}
                onPress={handleDriveBackup}
            />
            <SettingsRow
                label="Restore memory from Google Drive"
                detail={drive.remoteFiles[0] ? `Latest: ${drive.remoteFiles[0].name}` : 'Uses the newest Drive backup.'}
                disabled={isBusy || driveBusy}
                onPress={handleDriveRestore}
            />
            <SettingsRow
                label="Clear history & memories"
                detail="Removes journal entries, intentions, chat sessions, insights, and saved AI memories."
                destructive
                disabled={isBusy || isClearingHistory}
                showBorder={false}
                onPress={onClearHistory}
            />
        </SettingsSection>
    );
}
