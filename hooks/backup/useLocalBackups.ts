import { useCallback, useEffect, useMemo, useState } from 'react';

import {
    createLocalBackup,
    listLocalBackups,
    restoreLocalBackup,
} from '@/services/backup/localBackup';
import { getActiveAccountId } from '@/services/account/accountRuntime';
import { runLocalOperationWithAccountRecovery } from '@/services/account/accountOperationRecovery';
import type {
    LocalBackupManifest,
    RestoreLocalBackupResult,
} from '@/services/backup/localBackup';

function getBackupErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Local backup operation failed.';
}

export function useLocalBackups() {
    const [backups, setBackups] = useState<LocalBackupManifest[]>([]);
    const [isBusy, setIsBusy] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const refresh = useCallback(async (): Promise<LocalBackupManifest[]> => {
        const nextBackups = await listLocalBackups();
        setBackups(nextBackups);
        return nextBackups;
    }, []);

    useEffect(() => {
        let isMounted = true;

        const load = async () => {
            try {
                const nextBackups = await listLocalBackups();
                if (isMounted) {
                    setBackups(nextBackups);
                }
            } catch (error) {
                if (isMounted) {
                    setErrorMessage(getBackupErrorMessage(error));
                }
            }
        };

        void load();

        return () => {
            isMounted = false;
        };
    }, []);

    const createBackup = useCallback(async (): Promise<LocalBackupManifest> => {
        setIsBusy(true);
        setErrorMessage(null);
        try {
            // Local-only writes: a dead auth gateway must not abort them
            // (DEF-012). The pinned account is checked so a real account
            // switch is still respected.
            const pinnedAccountId = getActiveAccountId();
            const backup = await runLocalOperationWithAccountRecovery(
                pinnedAccountId,
                () => createLocalBackup(),
            );
            await refresh();
            return backup;
        } catch (error) {
            setErrorMessage(getBackupErrorMessage(error));
            throw error;
        } finally {
            setIsBusy(false);
        }
    }, [refresh]);

    const restoreBackup = useCallback(async (
        backupId: string
    ): Promise<RestoreLocalBackupResult> => {
        setIsBusy(true);
        setErrorMessage(null);
        try {
            const pinnedAccountId = getActiveAccountId();
            return await runLocalOperationWithAccountRecovery(
                pinnedAccountId,
                () => restoreLocalBackup(backupId),
            );
        } catch (error) {
            setErrorMessage(getBackupErrorMessage(error));
            throw error;
        } finally {
            setIsBusy(false);
        }
    }, []);

    const latestBackup = useMemo(() => backups[0] ?? null, [backups]);

    return {
        backups,
        latestBackup,
        isBusy,
        errorMessage,
        createBackup,
        restoreBackup,
        refresh,
    };
}
