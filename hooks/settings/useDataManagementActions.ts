import { useCallback } from 'react';
import { Alert } from 'react-native';

import { notifyUser, webConfirm } from '@/components/ui/webConfirm';
import { useLocalBackups } from '@/hooks/backup/useLocalBackups';
import { useClearJournalHistory } from '@/hooks/journal/useClearJournalHistory';

/** Keep user-facing failures plain; the underlying error stays out of the alert. */
function errorMessage(_error: unknown, fallback: string): string {
    return fallback;
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
            await createBackup();
            notifyUser('Backup created', 'Your journal and memories are saved on this device.');
        } catch (error) {
            notifyUser('Backup failed', errorMessage(error, 'Couldn’t create a backup.'));
        }
    }, [createBackup]);

    const restoreLatestBackup = useCallback(async () => {
        if (!latestBackup) {
            return;
        }
        try {
            const result = await restoreBackup(latestBackup.id);
            if (result.status === 'missing') {
                notifyUser('Backup missing', 'That backup couldn’t be found on this device.');
                return;
            }
            if (result.status === 'account-mismatch') {
                notifyUser('Backup unavailable', 'This backup can’t be restored on this device.');
                return;
            }
            notifyUser('Backup restored', 'Your journal and memories are back.');
        } catch (error) {
            notifyUser('Restore failed', errorMessage(error, 'Couldn’t restore that backup.'));
        }
    }, [latestBackup, restoreBackup]);

    const handleRestoreLatestBackup = useCallback(() => {
        if (!latestBackup) {
            notifyUser('No backup', 'Make a backup before restoring one.');
            return;
        }

        const message = `Restore "${latestBackup.name}"? This replaces everything currently in the app.`;
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
                    `Some things could not be deleted: ${result.failedSteps.join(', ')}. Try again, or report this list.`,
                );
                return;
            }
            notifyUser('History cleared', 'All history and related memories have been deleted.');
        } catch (error) {
            notifyUser('Clear history failed', errorMessage(error, 'Couldn’t clear history and memories.'));
        }
    }, [clearJournalHistory]);

    const handleClearHistory = useCallback(() => {
        const message =
            'Delete all journal entries, intention check-ins, saved chats, insights and saved memories from this device? This cannot be undone.';
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
