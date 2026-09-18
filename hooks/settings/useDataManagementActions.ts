import { useCallback } from 'react';
import { Alert } from 'react-native';

import { notifyUser, webConfirm } from '@/components/ui/webConfirm';
import { useLocalBackups } from '@/hooks/backup/useLocalBackups';
import { useClearJournalHistory } from '@/hooks/journal/useClearJournalHistory';

function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

/**
 * Local data-management actions for the Settings screen (backup / restore /
 * clear history).
 *
 * Extracted from `app/(tabs)/settings.tsx` for two reasons:
 * 1. The screen is at the 500-line design cap (AGENTS.md rule 6).
 * 2. Every outcome must be *visible*. These actions used `Alert.alert`, which
 *    renders nothing under react-native-web, so a failed clear or restore
 *    reported success-by-silence (docs/qa/DEFECTS.md DEF-009/011/012). They now
 *    route through `notifyUser`, and a partial wipe names the groups it could
 *    not clear.
 */
export function useDataManagementActions() {
    const { latestBackup, isBusy, createBackup, restoreBackup } = useLocalBackups();
    const { clearAll: clearJournalHistory, isClearing: isClearingHistory } = useClearJournalHistory();

    const handleCreateBackup = useCallback(async () => {
        try {
            const backup = await createBackup();
            notifyUser('Backup created', `${backup.itemCount} local data groups saved on this device.`);
        } catch (error) {
            notifyUser('Backup failed', errorMessage(error, 'Failed to create backup.'));
        }
    }, [createBackup]);

    const restoreLatestBackup = useCallback(async () => {
        if (!latestBackup) {
            return;
        }
        try {
            const result = await restoreBackup(latestBackup.id);
            if (result.status === 'missing') {
                notifyUser('Backup missing', 'The selected local backup could not be found.');
                return;
            }
            if (result.status === 'account-mismatch') {
                notifyUser('Backup unavailable', 'This backup belongs to a different account.');
                return;
            }
            notifyUser('Backup restored', `${result.restoredKeys} local data groups restored.`);
        } catch (error) {
            notifyUser('Restore failed', errorMessage(error, 'Failed to restore backup.'));
        }
    }, [latestBackup, restoreBackup]);

    const handleRestoreLatestBackup = useCallback(() => {
        if (!latestBackup) {
            notifyUser('No backup', 'Create a local backup before restoring.');
            return;
        }

        const message = `Restore "${latestBackup.name}"? Current local app data will be replaced.`;
        const webAnswer = webConfirm(message);
        if (webAnswer === false) {
            return;
        }
        if (webAnswer === true) {
            void restoreLatestBackup();
            return;
        }

        Alert.alert('Restore local backup', message, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Restore', style: 'destructive', onPress: () => { void restoreLatestBackup(); } },
        ]);
    }, [latestBackup, restoreLatestBackup]);

    const runClearJournalHistory = useCallback(async () => {
        try {
            const result = await clearJournalHistory();
            if (result.failedSteps.length > 0) {
                notifyUser(
                    'Clear history incomplete',
                    `These groups could not be cleared: ${result.failedSteps.join(', ')}. Retry, or report this with the list above.`,
                );
                return;
            }
            notifyUser('Success', 'All history and related memories have been deleted.');
        } catch (error) {
            notifyUser('Clear history failed', errorMessage(error, 'Failed to clear history and memories.'));
        }
    }, [clearJournalHistory]);

    const handleClearHistory = useCallback(() => {
        const message =
            'Delete all journal entries, intention check-ins, chat sessions, insights, and saved AI memories from this device? This action cannot be undone.';
        const webAnswer = webConfirm(message);
        if (webAnswer === false) {
            return;
        }
        if (webAnswer === true) {
            void runClearJournalHistory();
            return;
        }

        Alert.alert('Clear History & Memories', message, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: () => { void runClearJournalHistory(); },
            },
        ]);
    }, [runClearJournalHistory]);

    return {
        latestBackup,
        isBusy,
        isClearingHistory,
        handleCreateBackup,
        handleRestoreLatestBackup,
        handleClearHistory,
    };
}
