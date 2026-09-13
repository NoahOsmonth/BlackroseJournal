import { accountScopedStorage as AsyncStorage } from '@/services/account/accountScopedStorage';
import { runAccountBoundOperation } from '@/services/account/accountRuntime';

/**
 * ClawX-model file-semantic memory, phone-portable.
 *
 * Each memory is one doc with markdown-style frontmatter semantics
 * (name/description/type/scope/projectId/timestamps/deprecated) plus a
 * `##`-section body. One AsyncStorage key per doc + one lightweight
 * manifest — recall scans the manifest (headers only), bodies load only
 * for winners. No embeddings, fully offline.
 */

export type MemoryFileType = 'user' | 'feedback' | 'project';
export type MemoryFileScope = 'global' | 'project';

export interface MemoryFileFrontmatter {
    name: string;
    description: string;
    type: MemoryFileType;
    scope: MemoryFileScope;
    projectId?: string;
    updatedAt: string;
    capturedAt?: string;
    sourceSessionKey?: string;
    deprecated?: boolean;
}

export interface MemoryFileHeader extends MemoryFileFrontmatter {
    id: string;
    relativePath: string;
}

export interface MemoryFileRecord extends MemoryFileHeader {
    content: string;
    preview: string;
}

export interface StageMemoryInput {
    type: 'feedback' | 'project';
    name: string;
    description: string;
    body: string;
    projectId?: string;
    sourceSessionKey?: string;
}

export interface ListMemoryFilesOptions {
    kind?: 'all' | MemoryFileType;
    query?: string;
    projectId?: string;
    limit?: number;
    offset?: number;
    includeDeprecated?: boolean;
}

interface MemoryFilesStorageAdapter {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
}

export const MEMORY_FILES_MANIFEST_KEY = '@blackrose_memory_manifest';
export const MEMORY_FILE_BODY_PREFIX = '@blackrose_memory_file:';
export const MEMORY_FILES_SCHEMA_VERSION = 1;
export const TMP_PROJECT_ID = '_tmp';

const HEADER_PREVIEW_CHARS = 220;
const BODY_PREVIEW_CHARS = 2000;

let storageAdapter: MemoryFilesStorageAdapter = AsyncStorage;

export function setMemoryFilesStorageAdapter(adapter: MemoryFilesStorageAdapter): void {
    storageAdapter = adapter;
}

export function resetMemoryFilesStorageAdapter(): void {
    storageAdapter = AsyncStorage;
}

// All read-modify-write cycles go through this queue (rule 4: no
// interleaved load->save pairs).
let filesWriteQueue: Promise<unknown> = Promise.resolve();

function withFilesLock<T>(task: () => Promise<T>): Promise<T> {
    return runAccountBoundOperation('memory-files', async () => {
        const run = filesWriteQueue.then(task, task);
        filesWriteQueue = run.catch(() => undefined);
        return run;
    });
}

type ManifestDoc = Record<string, MemoryFileHeader>;

function nowIso(): string {
    return new Date().toISOString();
}

function normalizeText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function slugify(value: string): string {
    const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug || 'memory-item';
}

function hashText(value: string): string {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash * 31 + value.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(36);
}

function normalizeProjectId(value: string | undefined): string {
    const trimmed = normalizeText(value ?? '');
    if (!trimmed || trimmed === TMP_PROJECT_ID) return TMP_PROJECT_ID;
    return trimmed.toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || TMP_PROJECT_ID;
}

function isHeader(value: unknown): value is MemoryFileHeader {
    if (typeof value !== 'object' || value === null) return false;
    const h = value as Partial<MemoryFileHeader>;
    return typeof h.id === 'string'
        && typeof h.relativePath === 'string'
        && typeof h.name === 'string'
        && typeof h.description === 'string'
        && (h.type === 'user' || h.type === 'feedback' || h.type === 'project')
        && (h.scope === 'global' || h.scope === 'project')
        && typeof h.updatedAt === 'string';
}

function sanitizeManifest(value: unknown): ManifestDoc {
    if (typeof value !== 'object' || value === null) return {};
    const out: ManifestDoc = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, candidate]) => {
        if (isHeader(candidate)) out[key] = candidate;
    });
    return out;
}

async function loadManifest(): Promise<ManifestDoc> {
    const json = await storageAdapter.getItem(MEMORY_FILES_MANIFEST_KEY);
    if (!json) return {};
    try {
        const parsed: unknown = JSON.parse(json);
        if (typeof parsed !== 'object' || parsed === null) return {};
        if ('schemaVersion' in (parsed as Record<string, unknown>)) {
            return sanitizeManifest((parsed as { files?: unknown }).files);
        }
        return sanitizeManifest(parsed);
    } catch {
        return {};
    }
}

async function saveManifest(doc: ManifestDoc): Promise<void> {
    await storageAdapter.setItem(
        MEMORY_FILES_MANIFEST_KEY,
        JSON.stringify({ schemaVersion: MEMORY_FILES_SCHEMA_VERSION, files: doc }),
    );
}

function bodyKey(id: string): string {
    return `${MEMORY_FILE_BODY_PREFIX}${id}`;
}

function previewText(body: string, max: number): string {
    const flat = body.split('\n').map((line) => normalizeText(line)).filter(Boolean).join(' ');
    return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}

/**
 * Stage a new memory into the `_tmp` project (ClawX `_tmp` pattern).
 * Dream (Wave 2) promotes tmp files into formal thread projects.
 */
export async function stageTmpMemory(input: StageMemoryInput): Promise<MemoryFileRecord> {
    const name = normalizeText(input.name).slice(0, 120) || 'memory-item';
    const description = normalizeText(input.description).slice(0, 320) || name;
    const body = input.body.trim();
    if (!body) throw new Error('body is required');
    const projectId = normalizeProjectId(input.projectId);
    const fingerprint = hashText(`${input.type}|${name}|${description}|${body.slice(0, 400)}`);
    const id = `projects/${projectId}/${input.type === 'feedback' ? 'Feedback' : 'Project'}/${slugify(name)}-${fingerprint}.md`;
    const timestamp = nowIso();
    const header: MemoryFileHeader = {
        id,
        relativePath: id,
        name,
        description,
        type: input.type,
        scope: 'project',
        projectId,
        updatedAt: timestamp,
        capturedAt: timestamp,
        ...(input.sourceSessionKey ? { sourceSessionKey: input.sourceSessionKey } : {}),
    };
    await withFilesLock(async () => {
        const manifest = await loadManifest();
        manifest[id] = header;
        await saveManifest(manifest);
        await storageAdapter.setItem(bodyKey(id), body);
    });
    return { ...header, content: body, preview: previewText(body, HEADER_PREVIEW_CHARS) };
}

function scoreHeader(header: MemoryFileHeader, tokens: string[]): number {
    if (tokens.length === 0) return 0;
    const hay = `${header.name} ${header.description} ${header.projectId ?? ''}`.toLowerCase();
    return tokens.reduce((total, token) => total + (hay.includes(token) ? 1 : 0), 0);
}

/**
 * Header-only browse (manifest scan, never body reads) — the ClawX
 * manifest-scan step. Paginated for the `memory_list` tool.
 */
export async function listMemoryFiles(options: ListMemoryFilesOptions = {}): Promise<MemoryFileHeader[]> {
    const limit = Math.max(1, Math.min(50, options.limit ?? 10));
    const offset = Math.max(0, options.offset ?? 0);
    const query = normalizeText(options.query ?? '').toLowerCase();
    const tokens = query.split(/\s+/).filter((t) => t.length >= 3);
    const manifest = await withFilesLock(loadManifest);
    let entries = Object.values(manifest);
    if (!options.includeDeprecated) entries = entries.filter((e) => !e.deprecated);
    if (options.kind && options.kind !== 'all') entries = entries.filter((e) => e.type === options.kind);
    if (options.projectId) entries = entries.filter((e) => e.projectId === normalizeProjectId(options.projectId));
    if (query) {
        entries = entries
            .map((entry) => ({ entry, score: scoreHeader(entry, tokens.length ? tokens : [query]) }))
            .filter((row) => row.score > 0)
            .sort((a, b) => b.score - a.score || b.entry.updatedAt.localeCompare(a.entry.updatedAt))
            .map((row) => row.entry);
    } else {
        entries = entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    return entries.slice(offset, offset + limit);
}

/** Exact-id body loads for ids returned by list/search. */
export async function getMemoryRecordsByIds(ids: readonly string[]): Promise<MemoryFileRecord[]> {
    const unique = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean))).slice(0, 10);
    if (unique.length === 0) return [];
    const manifest = await withFilesLock(loadManifest);
    const records: MemoryFileRecord[] = [];
    for (const id of unique) {
        const header = manifest[id];
        if (!header || header.deprecated) continue;
        const body = await storageAdapter.getItem(bodyKey(id));
        if (typeof body !== 'string') continue;
        records.push({ ...header, content: body, preview: previewText(body, BODY_PREVIEW_CHARS) });
    }
    return records;
}

/** Formal thread projects (excludes `_tmp`) for the recall shortlist. */
export async function listFormalProjectIds(): Promise<string[]> {
    const manifest = await withFilesLock(loadManifest);
    const ids = new Set<string>();
    Object.values(manifest).forEach((header) => {
        if (header.deprecated || !header.projectId || header.projectId === TMP_PROJECT_ID) return;
        ids.add(header.projectId);
    });
    return Array.from(ids).sort();
}

/** All non-deprecated `_tmp` staged files awaiting Dream. */
export async function listTmpFiles(): Promise<MemoryFileHeader[]> {
    const manifest = await withFilesLock(loadManifest);
    return Object.values(manifest)
        .filter((h) => !h.deprecated && h.projectId === TMP_PROJECT_ID)
        .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
}

/** True when this session already staged at least one file (idempotency). */
export async function hasStagedSession(sourceSessionKey: string): Promise<boolean> {
    const key = sourceSessionKey.trim();
    if (!key) return false;
    const manifest = await withFilesLock(loadManifest);
    return Object.values(manifest).some((h) => h.sourceSessionKey === key);
}

export interface ManifestStats {
    formalThreads: number;
    formalFiles: number;
    tmpFiles: number;
    userFiles: number;
    totalFiles: number;
    lastUpdatedAt: string;
}

/** Counts for `memory_overview` — header-only, one manifest read. */
export async function getManifestStats(): Promise<ManifestStats> {
    const manifest = await withFilesLock(loadManifest);
    const live = Object.values(manifest).filter((h) => !h.deprecated);
    const threads = new Set<string>();
    let formalFiles = 0;
    let tmpFiles = 0;
    let userFiles = 0;
    let lastUpdatedAt = '';
    live.forEach((h) => {
        if (h.updatedAt > lastUpdatedAt) lastUpdatedAt = h.updatedAt;
        if (h.type === 'user') {
            userFiles += 1;
            return;
        }
        if (h.projectId === TMP_PROJECT_ID) tmpFiles += 1;
        else if (h.projectId) {
            formalFiles += 1;
            threads.add(h.projectId);
        }
    });
    return {
        formalThreads: threads.size,
        formalFiles,
        tmpFiles,
        userFiles,
        totalFiles: live.length,
        lastUpdatedAt,
    };
}

/**
 * Promote a `_tmp` file into a formal thread (Dream). Writes the new doc,
 * deprecates the tmp original, all under one lock.
 */
export async function promoteTmpRecord(id: string, targetProjectId: string): Promise<MemoryFileHeader | null> {
    const target = normalizeProjectId(targetProjectId);
    if (!target || target === TMP_PROJECT_ID) return null;
    return withFilesLock(async () => {
        const manifest = await loadManifest();
        const source = manifest[id];
        if (!source || source.deprecated || source.projectId !== TMP_PROJECT_ID) return null;
        const body = await storageAdapter.getItem(bodyKey(id));
        if (typeof body !== 'string') return null;
        const timestamp = nowIso();
        const newId = `projects/${target}/${source.type === 'feedback' ? 'Feedback' : 'Project'}/${slugify(source.name)}-${hashText(body.slice(0, 400))}.md`;
        const header: MemoryFileHeader = {
            ...source,
            id: newId,
            relativePath: newId,
            scope: 'project',
            projectId: target,
            updatedAt: timestamp,
        };
        manifest[newId] = header;
        manifest[id] = { ...source, deprecated: true, updatedAt: timestamp };
        await saveManifest(manifest);
        await storageAdapter.setItem(bodyKey(newId), body);
        return header;
    });
}

/** Soft-delete a file (deprecated, kept for audit, excluded everywhere). */
export async function deprecateRecord(id: string): Promise<boolean> {
    return withFilesLock(async () => {
        const manifest = await loadManifest();
        const existing = manifest[id];
        if (!existing || existing.deprecated) return false;
        manifest[id] = { ...existing, deprecated: true, updatedAt: nowIso() };
        await saveManifest(manifest);
        return true;
    });
}

export interface MemoryFileImportRecord {
    header: MemoryFileHeader;
    content: string;
}

function isImportRecord(value: unknown): value is MemoryFileImportRecord {
    if (typeof value !== 'object' || value === null) return false;
    const rec = value as Partial<MemoryFileImportRecord>;
    return isHeader(rec.header) && typeof rec.content === 'string';
}

/**
 * Bulk import (Drive restore). Validates every record, skips ids already
 * present, writes the rest under one lock. Fail-closed on garbage.
 */
export async function importMemoryFiles(records: unknown): Promise<{ imported: number; skipped: number }> {
    if (!Array.isArray(records)) throw new Error('Memory file records must be an array.');
    const valid = records.filter(isImportRecord).slice(0, 1000);
    if (valid.length !== records.length) throw new Error('Backup contains invalid memory file records.');
    return withFilesLock(async () => {
        const manifest = await loadManifest();
        let imported = 0;
        let skipped = 0;
        for (const record of valid) {
            if (manifest[record.header.id]) {
                skipped += 1;
                continue;
            }
            manifest[record.header.id] = record.header;
            await storageAdapter.setItem(bodyKey(record.header.id), record.content);
            imported += 1;
        }
        await saveManifest(manifest);
        return { imported, skipped };
    });
}

/**
 * Delete every file staged from the given sessions (demo-clear: only rows the
 * seed ledger tracks, never real sessions). Returns the number removed.
 */
export async function deleteMemoryFilesBySourceSessions(
    sourceSessionKeys: readonly string[],
): Promise<number> {
    const doomedSources = new Set(sourceSessionKeys.filter((key) => typeof key === 'string' && key.trim()));
    if (doomedSources.size === 0) return 0;
    return withFilesLock(async () => {
        const manifest = await loadManifest();
        const doomed = Object.values(manifest)
            .filter((header) => header.sourceSessionKey && doomedSources.has(header.sourceSessionKey))
            .map((header) => header.id);
        if (doomed.length === 0) return 0;
        for (const id of doomed) delete manifest[id];
        // Header first: a crash mid-cleanup leaves an orphan body, never a dangling header.
        await saveManifest(manifest);
        for (const id of doomed) {
            try {
                await storageAdapter.removeItem(bodyKey(id));
            } catch {
                // Best effort.
            }
        }
        return doomed.length;
    });
}

export async function clearMemoryFiles(): Promise<void> {
    const manifest = await withFilesLock(async () => {
        const doc = await loadManifest();
        await saveManifest({});
        return doc;
    });
    await withFilesLock(async () => {
        for (const id of Object.keys(manifest)) {
            try {
                await storageAdapter.removeItem(bodyKey(id));
            } catch {
                // Best effort.
            }
        }
    });
}
