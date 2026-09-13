import {
    buildMemorySnapshot,
    createDriveBackupClient,
    createGoogleDriveAuth,
    DRIVE_BACKUP_FORMAT,
    resolveDriveClientId,
    restoreMemorySnapshot,
} from '../../services/backup/driveBackup';
import type { DriveFetch } from '../../services/backup/driveBackup';
import {
    applyIdentityPatch,
    clearIdentityProfile,
    getIdentityProfile,
    resetIdentityStorageAdapter,
    setIdentityStorageAdapter,
} from '../../services/memory/identityProfile';
import {
    clearMemoryAtoms,
    listMemoryAtoms,
    resetMemoryStorageAdapter,
    setMemoryStorageAdapter,
    upsertMemoryAtom,
} from '../../services/memory/localMemory';
import {
    clearMemoryFiles,
    listMemoryFiles,
    resetMemoryFilesStorageAdapter,
    setMemoryFilesStorageAdapter,
    stageTmpMemory,
} from '../../services/memory/memoryFiles';

function createAdapter() {
    const store = new Map<string, string>();
    return {
        getItem: jest.fn(async (key: string) => store.get(key) ?? null),
        setItem: jest.fn(async (key: string, value: string) => {
            store.set(key, value);
        }),
        removeItem: jest.fn(async (key: string) => {
            store.delete(key);
        }),
    };
}

function seedMemoryAdapters() {
    setIdentityStorageAdapter(createAdapter());
    setMemoryStorageAdapter(createAdapter());
    setMemoryFilesStorageAdapter(createAdapter());
}

function resetMemoryAdapters() {
    resetIdentityStorageAdapter();
    resetMemoryStorageAdapter();
    resetMemoryFilesStorageAdapter();
}

function jsonResponse(payload: unknown, ok = true, status = 200): Response {
    return { ok, status, json: async () => payload } as Response;
}

describe('driveBackup snapshot (Wave 3)', () => {
    beforeEach(seedMemoryAdapters);
    afterEach(async () => {
        await Promise.all([clearIdentityProfile(), clearMemoryAtoms(), clearMemoryFiles()]);
        resetMemoryAdapters();
    });

    it('round-trips identity, atoms, and files through a snapshot', async () => {
        await applyIdentityPatch({ preferredName: 'Sam', forceApply: true, source: 'manual' });
        await upsertMemoryAtom({
            layer: 'note', source: 'manual', sourceId: 'note:1',
            title: 'Pinned note', content: 'Remember the promotion plan',
        });
        await stageTmpMemory({
            type: 'project', name: 'Work: Launch', description: 'Thread hint work. launch',
            body: '## Current Stage\nPlanning',
        });

        const snapshot = await buildMemorySnapshot();
        expect(snapshot.formatVersion).toBe(DRIVE_BACKUP_FORMAT);
        expect(snapshot.atoms).toHaveLength(1);
        expect(snapshot.files).toHaveLength(1);

        await Promise.all([clearIdentityProfile(), clearMemoryAtoms(), clearMemoryFiles()]);
        expect(await listMemoryAtoms()).toHaveLength(0);

        const result = await restoreMemorySnapshot(JSON.parse(JSON.stringify(snapshot)));
        expect(result).toEqual({ identityRestored: true, restoredAtoms: 1, importedFiles: 1, skippedFiles: 0 });
        expect((await getIdentityProfile()).preferredName?.value).toBe('Sam');
        expect(await listMemoryAtoms()).toHaveLength(1);
        expect(await listMemoryFiles({})).toHaveLength(1);

        // Re-restore is idempotent on files (skips existing ids).
        const second = await restoreMemorySnapshot(JSON.parse(JSON.stringify(snapshot)));
        expect(second.skippedFiles).toBe(1);
    });

    it('rejects garbage and wrong format versions', async () => {
        await expect(restoreMemorySnapshot(null)).rejects.toThrow();
        await expect(restoreMemorySnapshot({ formatVersion: 'nope.v0' })).rejects.toThrow();
        // Right shape, wrong version — must still refuse (forward-compat is explicit, never silent).
        await expect(restoreMemorySnapshot({
            formatVersion: 'blackrose-memory-backup.v9',
            exportedAt: new Date().toISOString(),
            identity: null,
            atoms: [],
            files: [],
        })).rejects.toThrow();
        await expect(restoreMemorySnapshot({
            formatVersion: DRIVE_BACKUP_FORMAT, exportedAt: 'x', identity: null, atoms: [], files: [{ nope: true }],
        })).rejects.toThrow();
    });
});

describe('driveBackup transport (Wave 3)', () => {
    it('resolves the client id only from env', () => {
        expect(resolveDriveClientId({})).toBeNull();
        expect(resolveDriveClientId({ EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID: '  ' })).toBeNull();
        expect(resolveDriveClientId({ EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID: 'abc' })).toBe('abc');
    });

    it('signs in via code flow and exchanges the token', async () => {
        const calls: string[] = [];
        const fetchFn: DriveFetch = async (url) => {
            calls.push(url);
            return jsonResponse({ access_token: 'tok123' });
        };
        const auth = createGoogleDriveAuth({
            clientId: 'cid',
            opener: async () => ({ type: 'success', url: 'blackrosejournal://drive-auth?code=authcode' }),
            fetchFn,
        });
        await expect(auth.signIn()).resolves.toBe('tok123');
        expect(calls[0]).toContain('oauth2.googleapis.com/token');
        await expect(auth.getAccessToken()).resolves.toBe('tok123');
    });

    it('throws when sign-in is cancelled', async () => {
        const auth = createGoogleDriveAuth({
            clientId: 'cid',
            opener: async () => ({ type: 'cancel' }),
            fetchFn: async () => jsonResponse({}),
        });
        await expect(auth.signIn()).rejects.toThrow('cancelled');
    });

    it('lists, uploads, and downloads through appDataFolder', async () => {
        const seen: { url: string; init?: RequestInit }[] = [];
        const fetchFn: DriveFetch = async (url, init) => {
            seen.push({ url, init });
            if (url.includes('/upload/')) return jsonResponse({ id: 'file1', name: 'b.json' });
            if (url.includes('alt=media')) return jsonResponse({ formatVersion: DRIVE_BACKUP_FORMAT });
            return jsonResponse({ files: [{ id: 'file1', name: 'b.json', modifiedTime: '2026-01-01' }] });
        };
        const auth = createGoogleDriveAuth({ clientId: 'cid', fetchFn });
        // Pre-seed token without browser: stub opener succeeds then exchange.
        const client = createDriveBackupClient(fetchFn);
        const stubAuth = {
            getAccessToken: async () => 'tok' as string | null,
            signIn: async () => 'tok',
            signOut: async () => undefined,
        };
        const files = await client.listBackups(stubAuth);
        expect(files).toEqual([{ id: 'file1', name: 'b.json', modifiedTime: '2026-01-01' }]);
        expect(seen[0]?.url).toContain('spaces=appDataFolder');

        const uploaded = await client.uploadBackup(stubAuth, 'b.json', '{"a":1}');
        expect(uploaded.id).toBe('file1');
        expect(seen[1]?.init?.method).toBe('POST');
        expect(String(seen[1]?.init?.headers && (seen[1]?.init?.headers as Record<string, string>)['Content-Type'])).toContain('multipart/related');

        await expect(client.downloadBackup(stubAuth, 'file1')).resolves.toEqual({ formatVersion: DRIVE_BACKUP_FORMAT });
        void auth;
    });

    it('surfaces Drive HTTP failures as errors', async () => {
        const client = createDriveBackupClient(async () => jsonResponse({}, false, 401));
        const stubAuth = {
            getAccessToken: async () => 'tok' as string | null,
            signIn: async () => 'tok',
            signOut: async () => undefined,
        };
        await expect(client.listBackups(stubAuth)).rejects.toThrow('401');
    });
});
