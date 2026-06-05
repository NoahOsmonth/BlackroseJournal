import { useCallback, useEffect, useMemo, useState } from 'react';

import {
    createLocalBackup,
    listLocalBackups,
    restoreLocalBackup,
} from '@/services/backup/localBackup';
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
            const backup = await createLocalBackup();
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
            return await restoreLocalBackup(backupId);
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
