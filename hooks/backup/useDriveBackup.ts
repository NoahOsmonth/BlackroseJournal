import { useCallback, useState } from 'react';

import {
    buildMemorySnapshot,
    createDriveBackupClient,
    createGoogleDriveAuth,
    resolveDriveClientId,
    restoreMemorySnapshot,
} from '@/services/backup/driveBackup';
import type { DriveFileMeta } from '@/services/backup/driveBackup';

export type DriveBackupStatus = 'idle' | 'ready' | 'busy' | 'error' | 'not-configured';

function plural(count: number, one: string, many: string): string {
    return `${count} ${count === 1 ? one : many}`;
}

function backupFileName(now = new Date()): string {
    const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-');
    return `blackrose-memory-${stamp}.json`;
}

/**
 * Manual Google Drive backup for offline memory (Wave 3).
 * Sign-in per session (no stored secrets); everything soft-fails with a
 * human-readable message. Requires EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID.
 */
export function useDriveBackup() {
    const [status, setStatus] = useState<DriveBackupStatus>(() => (
        resolveDriveClientId() ? 'idle' : 'not-configured'
    ));
    const [detail, setDetail] = useState<string | null>(null);
    const [remoteFiles, setRemoteFiles] = useState<DriveFileMeta[]>([]);

    const runGuarded = useCallback(async (operation: () => Promise<string>): Promise<string | null> => {
        const clientId = resolveDriveClientId();
        if (!clientId) {
            setStatus('not-configured');
            setDetail('Google Drive backup isn’t set up on this device.');
            return null;
        }
        setStatus('busy');
        setDetail(null);
        try {
            const message = await operation();
            setStatus('ready');
            setDetail(message);
            return message;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Google Drive backup failed. Try again.';
            setStatus('error');
            setDetail(message);
            return null;
        }
    }, []);

    const refreshRemote = useCallback(async (): Promise<string | null> => runGuarded(async () => {
        const clientId = resolveDriveClientId();
        if (!clientId) throw new Error('Google Drive backup isn’t set up on this device.');
        const auth = createGoogleDriveAuth({ clientId });
        const files = await createDriveBackupClient().listBackups(auth);
        setRemoteFiles(files);
        return files.length ? `${files.length} backup${files.length === 1 ? '' : 's'} on Drive.` : 'No memory backups on Drive yet.';
    }), [runGuarded]);

    const backupNow = useCallback(async (): Promise<string | null> => runGuarded(async () => {
        const clientId = resolveDriveClientId();
        if (!clientId) throw new Error('Google Drive backup isn’t set up on this device.');
        const auth = createGoogleDriveAuth({ clientId });
        const snapshot = await buildMemorySnapshot();
        const uploaded = await createDriveBackupClient().uploadBackup(
            auth,
            backupFileName(),
            JSON.stringify(snapshot),
        );
        setRemoteFiles((prev) => [uploaded, ...prev]);
        return `Backed up ${plural(snapshot.atoms.length, 'memory', 'memories')} and ${plural(snapshot.files.length, 'note', 'notes')} as ${uploaded.name}.`;
    }), [runGuarded]);

    const restoreLatest = useCallback(async (): Promise<string | null> => runGuarded(async () => {
        const clientId = resolveDriveClientId();
        if (!clientId) throw new Error('Google Drive backup isn’t set up on this device.');
        const auth = createGoogleDriveAuth({ clientId });
        const client = createDriveBackupClient();
        const files = await client.listBackups(auth);
        setRemoteFiles(files);
        const latest = files[0];
        if (!latest) throw new Error('No memory backups on Drive yet.');
        const raw = await client.downloadBackup(auth, latest.id);
        const result = await restoreMemorySnapshot(raw);
        return `Restored ${latest.name}: ${plural(result.restoredAtoms, 'memory', 'memories')}, ${plural(result.importedFiles, 'note', 'notes')}${result.identityRestored ? ', and your profile' : ''}.`;
    }), [runGuarded]);

    return { status, detail, remoteFiles, backupNow, restoreLatest, refreshRemote };
}
