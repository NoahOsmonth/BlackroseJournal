import { applyIdentityPatch, getIdentityProfile } from '@/services/memory/identityProfile';
import type { IdentityProfile } from '@/services/memory/identityProfile.types';
import { importMemoryFiles, listMemoryFiles, getMemoryRecordsByIds } from '@/services/memory/memoryFiles';
import type { MemoryFileImportRecord } from '@/services/memory/memoryFiles';
import { importMemoryAtoms, listMemoryAtoms, MAX_MEMORY_ATOMS } from '@/services/memory/localMemory';
import type { LocalMemoryAtom, LocalMemoryAtomInput } from '@/services/memory/localMemory.types';

/**
 * Google Drive backup for the offline memory subsystem (Wave 3).
 *
 * Bundle (ClawX export-bundle pattern): identity profile + memory atoms +
 * memory files, one JSON doc with a format version. Journal entries,
 * check-ins, and day digests stay in on-device `localBackup` — this bundle
 * covers durable AI memory only.
 *
 * Transport notes:
 * - OAuth2 code flow via lazily-imported `expo-web-browser` + `expo-linking`
 *   (never loaded in Jest). No new native dependencies.
 * - Drive `appDataFolder` scope: hidden per-app folder, no broad Drive access.
 * - Client ID comes from `EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID` — never
 *   hardcoded. Absent ID → `not-configured`, soft-fail everywhere.
 * - `fetch` is injectable for tests; production passes global fetch.
 */

export const DRIVE_BACKUP_FORMAT = 'blackrose-memory-backup.v1';
export const DRIVE_BACKUP_MIME = 'application/json';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

export interface DriveMemorySnapshot {
    formatVersion: typeof DRIVE_BACKUP_FORMAT;
    exportedAt: string;
    identity: IdentityProfile | null;
    atoms: LocalMemoryAtom[];
    files: MemoryFileImportRecord[];
}

export interface DriveRestoreResult {
    identityRestored: boolean;
    restoredAtoms: number;
    importedFiles: number;
    skippedFiles: number;
}

function isSnapshot(value: unknown): value is DriveMemorySnapshot {
    if (typeof value !== 'object' || value === null) return false;
    const snap = value as Partial<DriveMemorySnapshot>;
    return snap.formatVersion === DRIVE_BACKUP_FORMAT
        && typeof snap.exportedAt === 'string'
        && (snap.identity === null || typeof snap.identity === 'object')
        && Array.isArray(snap.atoms)
        && Array.isArray(snap.files);
}

/** Build the memory bundle through owning modules (never raw key reads). */
export async function buildMemorySnapshot(): Promise<DriveMemorySnapshot> {
    const [identity, atoms] = await Promise.all([getIdentityProfile(), listMemoryAtoms()]);
    const headers = await listMemoryFiles({ limit: 50 });
    // Paginate the manifest (50/page) so large file sets export fully.
    const all = [...headers];
    let offset = headers.length;
    for (;;) {
        const page = await listMemoryFiles({ limit: 50, offset });
        if (page.length === 0) break;
        all.push(...page);
        offset += page.length;
        if (page.length < 50) break;
    }
    const records = await getMemoryRecordsByIds(all.map((h) => h.id), { limit: all.length });
    return {
        formatVersion: DRIVE_BACKUP_FORMAT,
        exportedAt: new Date().toISOString(),
        identity,
        atoms,
        files: records.map((r) => ({
            header: {
                id: r.id,
                relativePath: r.relativePath,
                name: r.name,
                description: r.description,
                type: r.type,
                scope: r.scope,
                ...(r.projectId ? { projectId: r.projectId } : {}),
                updatedAt: r.updatedAt,
                ...(r.capturedAt ? { capturedAt: r.capturedAt } : {}),
                ...(r.sourceSessionKey ? { sourceSessionKey: r.sourceSessionKey } : {}),
                ...(r.deprecated ? { deprecated: true } : {}),
            },
            content: r.content,
        })),
    };
}

/**
 * Restore a bundle. Fail-closed on invalid snapshots; per-store writes go
 * through owning modules (identity patch, atom upserts, file import).
 */
export async function restoreMemorySnapshot(raw: unknown): Promise<DriveRestoreResult> {
    if (!isSnapshot(raw)) throw new Error('Not a Blackrose memory backup (bad format version or shape).');
    let identityRestored = false;
    if (raw.identity && typeof raw.identity === 'object') {
        const profile = raw.identity;
        await applyIdentityPatch({
            ...(profile.preferredName?.value ? { preferredName: profile.preferredName.value } : {}),
            ...(profile.pronouns?.value ? { pronouns: profile.pronouns.value } : {}),
            ...(profile.about?.value ? { about: profile.about.value } : {}),
            ...(Array.isArray(profile.keyPeople) ? { keyPeople: profile.keyPeople.map((p) => ({ name: p.name, ...(p.relation ? { relation: p.relation } : {}) })) } : {}),
            ...(Array.isArray(profile.facts) ? { facts: profile.facts.map((f) => f.content) } : {}),
            forceApply: true,
            source: 'manual',
            reason: 'drive-restore',
        });
        identityRestored = true;
    }
    // Bounded by the store's own cap, not a second literal: `MAX_MEMORY_ATOMS` is
    // what the store keeps, so a real snapshot never exceeds it and the two
    // numbers cannot drift apart unnoticed.
    const accepted: LocalMemoryAtomInput[] = [];
    for (const atom of raw.atoms.slice(0, MAX_MEMORY_ATOMS)) {
        if (typeof atom !== 'object' || atom === null) continue;
        const a = atom as Partial<LocalMemoryAtom>;
        if (typeof a.layer !== 'string' || typeof a.source !== 'string'
            || typeof a.sourceId !== 'string' || typeof a.title !== 'string'
            || typeof a.content !== 'string') continue;
        accepted.push({
            layer: a.layer,
            source: a.source,
            sourceId: a.sourceId,
            ...(typeof a.rootSourceId === 'string' ? { rootSourceId: a.rootSourceId } : {}),
            ...(typeof a.rootSourceKind !== 'undefined' ? { rootSourceKind: a.rootSourceKind } : {}),
            title: a.title,
            content: a.content,
            ...(Array.isArray(a.tags) ? { tags: a.tags.filter((t): t is string => typeof t === 'string') } : {}),
            ...(typeof a.salience === 'number' ? { salience: a.salience } : {}),
            ...(typeof a.confidence === 'number' ? { confidence: a.confidence } : {}),
            ...(typeof a.createdAt === 'number' ? { createdAt: a.createdAt } : {}),
            ...('eventDate' in a && (typeof a.eventDate === 'string' || a.eventDate === null) ? { eventDate: a.eventDate } : {}),
        });
    }
    // One locked write for the whole snapshot. Per-atom upserts would re-read and
    // re-serialize the entire store once per atom — 4000 atoms, 4000 round trips.
    const restoredAtoms = await importMemoryAtoms(accepted);
    const { imported, skipped } = await importMemoryFiles(raw.files);
    return { identityRestored, restoredAtoms, importedFiles: imported, skippedFiles: skipped };
}

// ---------------------------------------------------------------------------
// Drive transport
// ---------------------------------------------------------------------------

export type DriveFetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface DriveFileMeta {
    id: string;
    name: string;
    modifiedTime?: string;
}

export interface GoogleDriveAuth {
    getAccessToken(): Promise<string | null>;
    signIn(): Promise<string>;
    signOut(): Promise<void>;
}

interface BrowserOpener {
    (url: string, redirectUrl: string): Promise<{ type: string; url?: string }>;
}

function parseCodeFromUrl(url: string): string | null {
    try {
        const query = url.split('?')[1] ?? '';
        const code = new URLSearchParams(query).get('code');
        return code || null;
    } catch {
        return null;
    }
}

/**
 * Google OAuth2 code flow. Expo modules load lazily so Jest never touches
 * native code; tests inject `opener` + `fetchFn`.
 */
export function createGoogleDriveAuth(options: {
    clientId: string;
    redirectUri?: string;
    opener?: BrowserOpener;
    fetchFn?: DriveFetch;
}): GoogleDriveAuth {
    const fetchFn: DriveFetch = options.fetchFn ?? ((url, init) => fetch(url, init));
    const redirectUri = options.redirectUri ?? 'blackrosejournal://drive-auth';
    let accessToken: string | null = null;

    return {
        getAccessToken: async () => accessToken,
        signOut: async () => {
            accessToken = null;
        },
        signIn: async () => {
            const params = new URLSearchParams({
                client_id: options.clientId,
                redirect_uri: redirectUri,
                response_type: 'code',
                scope: DRIVE_SCOPE,
                access_type: 'online',
                prompt: 'consent',
            });
            const opener: BrowserOpener = options.opener ?? (async (url: string, redirect: string) => {
                const browser = await import('expo-web-browser');
                return browser.openAuthSessionAsync(url, redirect);
            });
            const result = await opener(`${GOOGLE_AUTH_URL}?${params}`, redirectUri);
            if (result.type !== 'success' || !result.url) throw new Error('Google sign-in was cancelled.');
            const code = parseCodeFromUrl(result.url);
            if (!code) throw new Error('Google sign-in returned no auth code.');
            const tokenRes = await fetchFn(GOOGLE_TOKEN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    code,
                    client_id: options.clientId,
                    redirect_uri: redirectUri,
                    grant_type: 'authorization_code',
                }).toString(),
            });
            if (!tokenRes.ok) throw new Error(`Google token exchange failed (${tokenRes.status}).`);
            const payload = (await tokenRes.json()) as { access_token?: unknown };
            if (typeof payload.access_token !== 'string' || !payload.access_token) {
                throw new Error('Google token exchange returned no access token.');
            }
            accessToken = payload.access_token;
            return accessToken;
        },
    };
}

export function resolveDriveClientId(env: Record<string, string | undefined> = process.env): string | null {
    const id = env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID?.trim();
    return id ? id : null;
}

export interface DriveBackupClient {
    listBackups(auth: GoogleDriveAuth): Promise<DriveFileMeta[]>;
    uploadBackup(auth: GoogleDriveAuth, name: string, json: string): Promise<DriveFileMeta>;
    downloadBackup(auth: GoogleDriveAuth, fileId: string): Promise<unknown>;
}

async function authed(auth: GoogleDriveAuth): Promise<string> {
    const token = (await auth.getAccessToken()) ?? (await auth.signIn());
    if (!token) throw new Error('Google Drive sign-in required.');
    return token;
}

function backupQuery(namePrefix: string): string {
    return `appProperties has { key='blackrose-backup' and value='1' } and name contains '${namePrefix}' and trashed=false`;
}

export function createDriveBackupClient(fetchFn?: DriveFetch): DriveBackupClient {
    const run: DriveFetch = fetchFn ?? ((url, init) => fetch(url, init));
    return {
        listBackups: async (auth) => {
            const token = await authed(auth);
            const url = `${DRIVE_FILES_URL}?${new URLSearchParams({
                q: backupQuery('blackrose-memory'),
                spaces: 'appDataFolder',
                fields: 'files(id,name,modifiedTime)',
                orderBy: 'modifiedTime desc',
                pageSize: '20',
            })}`;
            const res = await run(url, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) throw new Error(`Drive list failed (${res.status}).`);
            const payload = (await res.json()) as { files?: unknown };
            if (!Array.isArray(payload.files)) return [];
            return payload.files
                .filter((f): f is DriveFileMeta => typeof f === 'object' && f !== null && typeof (f as DriveFileMeta).id === 'string')
                .map((f) => ({ id: f.id, name: typeof f.name === 'string' ? f.name : f.id, ...(typeof f.modifiedTime === 'string' ? { modifiedTime: f.modifiedTime } : {}) }));
        },
        uploadBackup: async (auth, name, json) => {
            const token = await authed(auth);
            const boundary = `blackrose${Date.now().toString(36)}`;
            const metadata = JSON.stringify({
                name,
                mimeType: DRIVE_BACKUP_MIME,
                parents: ['appDataFolder'],
                appProperties: { 'blackrose-backup': '1' },
            });
            const body = [
                `--${boundary}`,
                'Content-Type: application/json; charset=UTF-8',
                '',
                metadata,
                `--${boundary}`,
                `Content-Type: ${DRIVE_BACKUP_MIME}`,
                '',
                json,
                `--${boundary}--`,
                '',
            ].join('\r\n');
            const res = await run(`${DRIVE_UPLOAD_URL}?${new URLSearchParams({ uploadType: 'multipart', fields: 'id,name,modifiedTime' })}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
                body,
            });
            if (!res.ok) throw new Error(`Drive upload failed (${res.status}).`);
            const payload = (await res.json()) as { id?: unknown; name?: unknown };
            if (typeof payload.id !== 'string') throw new Error('Drive upload returned no file id.');
            return { id: payload.id, name: typeof payload.name === 'string' ? payload.name : name };
        },
        downloadBackup: async (auth, fileId) => {
            const token = await authed(auth);
            const res = await run(`${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}?${new URLSearchParams({ alt: 'media' })}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(`Drive download failed (${res.status}).`);
            return res.json() as Promise<unknown>;
        },
    };
}
