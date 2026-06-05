import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useColorScheme } from '@/hooks/use-color-scheme';
import type { LocalBackupManifest } from '@/services/backup/localBackup';
import { SettingsSection } from './SettingsSection';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface DataManagementSectionProps {
    readonly latestBackup: LocalBackupManifest | null;
    readonly isBusy: boolean;
    readonly onCreateBackup: () => void;
    readonly onRestoreLatestBackup: () => void;
    readonly onExportJournalJson: () => void;
    readonly onClearJournalEntries: () => void;
}

interface SettingsRowProps {
    readonly label: string;
    readonly detail?: string;
    readonly iconName: IoniconName;
    readonly iconColor: string;
    readonly destructive?: boolean;
    readonly disabled?: boolean;
    readonly showBorder?: boolean;
    readonly onPress: () => void;
}

function SettingsRow({
    label,
    detail,
    iconName,
    iconColor,
    destructive = false,
    disabled = false,
    showBorder = true,
    onPress,
}: SettingsRowProps) {
    const textClass = destructive
        ? 'text-red-600 dark:text-red-400'
        : 'text-text-light dark:text-text-dark';

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            className={`flex-row items-center justify-between py-3 ${
                showBorder ? 'border-b border-divider-light dark:border-divider-dark mb-2' : 'mt-2'
            } ${disabled ? 'opacity-50' : ''}`}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
        >
            <View className="flex-row items-center gap-3 flex-1 pr-4">
                <View className="bg-background-light dark:bg-secondary-dark p-2 rounded-lg">
                    <Ionicons name={iconName} size={20} color={iconColor} />
                </View>
                <View className="flex-1">
                    <Text className={`${textClass} font-medium text-base`}>
                        {label}
                    </Text>
                    {detail ? (
                        <Text className="text-xs text-subtext-light dark:text-subtext-dark mt-1">
                            {detail}
                        </Text>
                    ) : null}
                </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={iconColor} />
        </TouchableOpacity>
    );
}

export function DataManagementSection({
    latestBackup,
    isBusy,
    onCreateBackup,
    onRestoreLatestBackup,
    onExportJournalJson,
    onClearJournalEntries,
}: DataManagementSectionProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const iconColor = isDark ? '#F9FAFB' : '#111827';
    const dangerIconColor = isDark ? '#F87171' : '#DC2626';
    const latestLabel = latestBackup ? `Latest: ${latestBackup.name}` : 'No local backup yet';

    return (
        <SettingsSection title="Data Management">
            <SettingsRow
                label="Create Local Backup"
                detail="Saves journal, goals, intentions, insights, personas, and settings on this device."
                iconName="archive-outline"
                iconColor={iconColor}
                disabled={isBusy}
                onPress={onCreateBackup}
            />
            <SettingsRow
                label="Restore Latest Backup"
                detail={latestLabel}
                iconName="refresh-outline"
                iconColor={iconColor}
                disabled={isBusy || !latestBackup}
                onPress={onRestoreLatestBackup}
            />
            <SettingsRow
                label="Export Journal JSON"
                detail="Shares a plain JSON export of journal entries only."
                iconName="share-outline"
                iconColor={iconColor}
                disabled={isBusy}
                onPress={onExportJournalJson}
            />
            <SettingsRow
                label="Clear Journal Entries"
                iconName="trash-outline"
                iconColor={dangerIconColor}
                destructive
                disabled={isBusy}
                showBorder={false}
                onPress={onClearJournalEntries}
            />
        </SettingsSection>
    );
}
