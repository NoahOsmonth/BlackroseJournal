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

/**
 * The one list. `isHeader` validates against it and the `memory_list` tool
 * derives its accepted kinds from it, because both previously hardcoded their
 * own copy: adding a type updated one and not the other, and the failure mode
 * was silence (a header dropped on load, or a filter that returned everything).
 */
export const MEMORY_FILE_TYPES = ['user', 'feedback', 'project', 'note'] as const;
export type MemoryFileType = (typeof MEMORY_FILE_TYPES)[number];
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
    /** R2 supersession audit — set only when a newer memory restated this one. */
    supersededBy?: string;
    supersededAt?: string;
    supersedeReason?: string;
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
    /**
     * When the memory was written, if the caller knows better than "now".
     * `updatedAt` stays the storage-write time; this is the date recall fades
     * and supersession orders by, so a caller replaying older entries can keep
     * their real chronology.
     */
    capturedAt?: string;
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

/**
 * When the memory was captured. Ordering uses this rather than `updatedAt`
 * because promotion and supersession both rewrite `updatedAt` — a promoted file
 * would otherwise look like the newest memory in the store. Unparseable dates
 * sort last instead of throwing.
 */
function headerCapturedAtMs(header: MemoryFileHeader): number {
    const parsed = Date.parse(header.capturedAt ?? header.updatedAt);
    return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Newest capture first, id ascending. Total and reproducible: two orderings
 * depend on it — `listMemoryFiles` is the recall recency fallback, and
 * `listTmpFiles` decides which files Dream's `MAX_DREAM_FILES` slice promotes —
 * so neither may rest on wall-clock ties or on manifest key order.
 */
function byCapturedDesc(a: MemoryFileHeader, b: MemoryFileHeader): number {
    return headerCapturedAtMs(b) - headerCapturedAtMs(a) || a.id.localeCompare(b.id);
}

/** Oldest capture first, id ascending — the backlog order Dream drains. */
function byCapturedAsc(a: MemoryFileHeader, b: MemoryFileHeader): number {
    return headerCapturedAtMs(a) - headerCapturedAtMs(b) || a.id.localeCompare(b.id);
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

/**
 * Pick an id that will not silently overwrite a *different* memory.
 *
 * Both writers (`stageTmpMemory`, `promoteTmpRecord`) derive an id from a header
 * plus only the **first 400 characters** of the body, then assign it outright
 * (`manifest[id] = header`). That is not a rare 32-bit hash collision — it is a
 * deterministic one: two distinct memories sharing a name, description and
 * opening 400 characters compute the *same* id every time, and the second write
 * destroys the first with nothing in the return value to say so. Reproed: two
 * distinct bodies, one file left in the store, the first unreachable.
 *
 * The base id is tried first, so every id already in a store keeps working and
 * nothing is rewritten — this is a guard, not the migration the finding assumed.
 * Only the losing write moves, and it moves *away*, never over.
 *
 * An id whose stored body is byte-identical is reused: re-staging the same
 * memory stays idempotent rather than accumulating copies.
 */
async function idWithoutOverwriting(
    manifest: ManifestDoc,
    body: string,
    baseId: string,
): Promise<string> {
    const stem = baseId.replace(/\.md$/, '');
    const wide = hashText(body);
    const candidates = [baseId, `${stem}-${wide}.md`];
    for (let n = 2; n <= 64; n += 1) candidates.push(`${stem}-${wide}-${n}.md`);
    for (const candidate of candidates) {
        if (!manifest[candidate]) return candidate;
        // Unreadable body: treat the slot as taken and widen, so a failed read can
        // never license an overwrite.
        if (await storageAdapter.getItem(bodyKey(candidate)) === body) return candidate;
    }
    return `${stem}-${wide}-overflow.md`;
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
        && typeof h.type === 'string'
        && (MEMORY_FILE_TYPES as readonly string[]).includes(h.type)
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
    const baseId = `projects/${projectId}/${input.type === 'feedback' ? 'Feedback' : 'Project'}/${slugify(name)}-${fingerprint}.md`;
    const timestamp = nowIso();
    // Capture date is what recall fades and supersession orders by; callers that
    // know the memory's real date (entry timestamps, replays) can supply it.
    const capturedAt = input.capturedAt && Number.isFinite(Date.parse(input.capturedAt))
        ? input.capturedAt
        : timestamp;
    let record: MemoryFileRecord | undefined;
    await withFilesLock(async () => {
        const manifest = await loadManifest();
        const id = await idWithoutOverwriting(manifest, body, baseId);
        const header: MemoryFileHeader = {
            id,
            relativePath: id,
            name,
            description,
            type: input.type,
            scope: 'project',
            projectId,
            updatedAt: timestamp,
            capturedAt,
            ...(input.sourceSessionKey ? { sourceSessionKey: input.sourceSessionKey } : {}),
        };
        // Body first, header second. An orphan body key is unreferenced and
        // reclaimable; a header with no bytes is an unreachable memory, because
        // every reader skips a missing body in silence.
        await storageAdapter.setItem(bodyKey(id), body);
        manifest[id] = header;
        await saveManifest(manifest);
        record = { ...header, content: body, preview: previewText(body, HEADER_PREVIEW_CHARS) };
    });
    // Assignment happens inside the locked task, so this is only undefined if the
    // lock never ran — which would mean the write did not happen either.
    if (!record) throw new Error('memory staging did not run');
    return record;
}

export interface StageUserNoteInput {
    text: string;
    /** Top tag from `extractTags` — becomes the thread hint. Absent when nothing was recognised. */
    threadHint?: string;
    /** Journal entry id; used for staging idempotency. */
    sourceEntryId: string;
    capturedAt?: string;
}

/** Lowercase slug used as the `Thread hint` token Dream clusters on. */
function noteHintSlug(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
}

/**
 * Stage a user-written note as a first-class memory file.
 *
 * Deliberately not `stageTmpMemory`: that writer's `type` union and its
 * `Project/` folder naming are for extracted memories, and widening it would let
 * a caller stage a note under a folder that says otherwise. A note is its own
 * kind of thing with its own id shape.
 *
 * The id is keyed on the **entry id**, not on the text. Two byte-identical notes
 * kept on different days are two memories, and hashing only the text would give
 * them one id and let the second silently overwrite the first's session key.
 *
 * The `Thread hint <slug>.` prefix is the exact convention `clusterTmpFiles`
 * groups on (`memoryDream.ts:43-46`), so Dream files a note beside the journal
 * memories of the same subject rather than in a separate pile.
 */
export async function stageUserNoteMemory(input: StageUserNoteInput): Promise<MemoryFileRecord> {
    const text = input.text.trim();
    if (!text) throw new Error('text is required');
    const entryKey = input.sourceEntryId.trim();
    if (!entryKey) throw new Error('sourceEntryId is required');

    const hint = noteHintSlug(input.threadHint ?? '');
    const name = `Note: ${normalizeText(text).slice(0, 60)}`;
    const description = (
        normalizeText(`${hint ? `Thread hint ${hint}. ` : ''}${text}`).slice(0, 320) || name
    );
    const body = ['## Note', text, '', '## Notes', '- Kept as written on Threads.'].join('\n');
    const capturedAt = input.capturedAt && Number.isFinite(Date.parse(input.capturedAt))
        ? input.capturedAt
        : nowIso();
    const baseId = `projects/${TMP_PROJECT_ID}/Note/${slugify(normalizeText(text).slice(0, 48))}-${hashText(entryKey)}.md`;

    let record: MemoryFileRecord | undefined;
    await withFilesLock(async () => {
        const manifest = await loadManifest();
        const id = await idWithoutOverwriting(manifest, body, baseId);
        const header: MemoryFileHeader = {
            id,
            relativePath: id,
            name,
            description,
            type: 'note',
            scope: 'project',
            projectId: TMP_PROJECT_ID,
            updatedAt: nowIso(),
            capturedAt,
            sourceSessionKey: entryKey,
        };
        // Body first: an orphan body is reclaimable, a header with no bytes is
        // an unreachable memory (see `promoteTmpRecord` for the full reasoning).
        await storageAdapter.setItem(bodyKey(id), body);
        manifest[id] = header;
        await saveManifest(manifest);
        record = { ...header, content: body, preview: previewText(body, HEADER_PREVIEW_CHARS) };
    });
    if (!record) throw new Error('note staging did not run');
    return record;
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
            .sort((a, b) => b.score - a.score || byCapturedDesc(a.entry, b.entry))
            .map((row) => row.entry);
    } else {
        entries = entries.sort(byCapturedDesc);
    }
    return entries.slice(offset, offset + limit);
}

/**
 * Every non-deprecated header, newest capture first.
 *
 * `listMemoryFiles` caps `limit` at 50 because it feeds prompts and UI pages.
 * Batch passes that would otherwise page once per project — supersession over
 * every thread, for instance — need the whole manifest from a single read
 * instead: paging per project made such a pass O(projects x manifest), which is
 * quadratic in the store's own growth.
 */
export async function listAllMemoryHeaders(): Promise<MemoryFileHeader[]> {
    const manifest = await withFilesLock(loadManifest);
    return Object.values(manifest)
        .filter((header) => !header.deprecated)
        .sort(byCapturedDesc);
}

/**
 * Every non-deprecated header of one thread, newest capture first, uncapped.
 *
 * `listMemoryFiles` caps `limit` at 50 because it feeds prompts and UI pages, so
 * it cannot serve a batch pass that needs a thread's whole history: asking it
 * for 400 came back as 50, silently. That is how supersession's per-thread
 * entry point ended up unable to see a thread's tail no matter what its own
 * window said. Same single manifest read either way.
 */
export async function listMemoryHeadersForThread(projectId: string): Promise<MemoryFileHeader[]> {
    const target = normalizeProjectId(projectId);
    return (await listAllMemoryHeaders()).filter((header) => header.projectId === target);
}

/**
 * Exact-id body loads for ids returned by list/search.
 *
 * There is deliberately no default cap. An unnamed 10 used to live here and
 * silently truncated whoever asked for more: Dream got 10 bodies for 20
 * candidates, supersession compared the newest 10 files of a thread, and drive
 * backup — which paginates the manifest specifically so large stores export
 * fully — exported 10 files. Bounding a request is the caller's job, because
 * only the caller knows how big a prompt or a bundle it is willing to build.
 */
export async function getMemoryRecordsByIds(
    ids: readonly string[],
    options: { limit?: number } = {},
): Promise<MemoryFileRecord[]> {
    const unique = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
    const requested = options.limit === undefined ? unique : unique.slice(0, options.limit);
    if (unique.length === 0) return [];
    const manifest = await withFilesLock(loadManifest);
    const records: MemoryFileRecord[] = [];
    for (const id of requested) {
        const header = manifest[id];
        if (!header || header.deprecated) continue;
        const body = await storageAdapter.getItem(bodyKey(id));
        if (typeof body !== 'string') {
            // A header with no bytes is a memory nobody can read. Writes are
            // body-first now, so this is either pre-fix data or a body removed
            // out of band — either way it must not disappear in silence.
            console.warn(`Memory file ${id} has a manifest header but no body; skipping.`);
            continue;
        }
        records.push({ ...header, content: body, preview: previewText(body, BODY_PREVIEW_CHARS) });
    }
    return records;
}

/**
 * Body loads for headers the caller already holds — no manifest read.
 *
 * `getMemoryRecordsByIds` re-reads the manifest to resolve ids, which is right
 * for a caller that only has ids and wrong for a batch pass that just read the
 * whole manifest itself: doing it per project turned supersession into
 * `threads + 1` full manifest parses per run.
 */
export async function getMemoryRecordsForHeaders(
    headers: readonly MemoryFileHeader[],
): Promise<MemoryFileRecord[]> {
    const records: MemoryFileRecord[] = [];
    for (const header of headers) {
        const body = await storageAdapter.getItem(bodyKey(header.id));
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

/**
 * Manifest headers whose body key is missing — a memory that exists on paper and
 * nowhere else. Every reader skips these silently, so without this they are
 * invisible forever. Reporting only: the body is gone, so there is nothing to
 * repair; the point is to stop the loss being silent.
 *
 * Writes are body-first, so a crash cannot create a new one of these.
 */
export async function findOrphanManifestHeaders(): Promise<MemoryFileHeader[]> {
    return withFilesLock(async () => {
        const manifest = await loadManifest();
        const orphans: MemoryFileHeader[] = [];
        for (const header of Object.values(manifest)) {
            const body = await storageAdapter.getItem(bodyKey(header.id));
            if (typeof body !== 'string') orphans.push(header);
        }
        return orphans;
    });
}

/** All non-deprecated `_tmp` staged files awaiting Dream. */
export async function listTmpFiles(): Promise<MemoryFileHeader[]> {
    const manifest = await withFilesLock(loadManifest);
    return Object.values(manifest)
        .filter((h) => !h.deprecated && h.projectId === TMP_PROJECT_ID)
        .sort(byCapturedAsc);
}

/** True when this session already staged at least one file (idempotency). */
export async function hasStagedSession(sourceSessionKey: string): Promise<boolean> {
    const key = sourceSessionKey.trim();
    if (!key) return false;
    const manifest = await withFilesLock(loadManifest);
    return Object.values(manifest).some((h) => h.sourceSessionKey === key);
}

/**
 * Every session key that has staged at least one file — one manifest read.
 *
 * `hasStagedSession` in a loop re-parses the whole manifest once per candidate,
 * the shape R2.2 measured at 401 manifest parses for a 200-thread pass. A
 * backlog scan needs the whole answer at once, so it reads it once.
 *
 * Deprecated headers count, deliberately, because `hasStagedSession` counts them.
 * The two must agree or flush would disagree with the per-session guard
 * `stageTmpMemory` uses: promotion spreads the source header onto the live
 * promoted file so the key usually survives there, but a promoted file that is
 * later superseded is deprecated in place — drop deprecated headers here and a
 * session whose memory supersession deliberately retired would look unstaged and
 * get staged again on the next flush.
 */
export async function listStagedSessionKeys(): Promise<Set<string>> {
    const manifest = await withFilesLock(loadManifest);
    const keys = new Set<string>();
    Object.values(manifest).forEach((h) => {
        if (h.sourceSessionKey) keys.add(h.sourceSessionKey);
    });
    return keys;
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
        const baseId = `projects/${target}/${source.type === 'feedback' ? 'Feedback' : 'Project'}/${slugify(source.name)}-${hashText(body.slice(0, 400))}.md`;
        // Same guard as staging: two distinct `_tmp` files whose bodies agree on
        // their first 400 characters would otherwise promote onto one id, and the
        // second would silently replace the first.
        const newId = await idWithoutOverwriting(manifest, body, baseId);
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
        // Same ordering as staging, and here it also protects the source: the
        // `_tmp` original is deprecated in this same manifest save, so a crash
        // after the save but before the body write would retire the source while
        // the promoted copy had no bytes — losing the memory outright.
        await storageAdapter.setItem(bodyKey(newId), body);
        await saveManifest(manifest);
        return header;
    });
}

export interface DeprecateRecordAudit {
    /** Id of the newer memory that restated this one (supersession audit). */
    supersededBy?: string;
    reason?: string;
}

/**
 * Soft-delete a file (deprecated, kept for audit, excluded everywhere).
 *
 * `audit` records *why* a record was superseded, following the identity
 * profile's doctrine: supersede by invalidating prior values, never silent
 * wipe. The body and header stay readable in storage.
 */
export async function deprecateRecord(id: string, audit: DeprecateRecordAudit = {}): Promise<boolean> {
    return withFilesLock(async () => {
        const manifest = await loadManifest();
        const existing = manifest[id];
        if (!existing || existing.deprecated) return false;
        const timestamp = nowIso();
        manifest[id] = {
            ...existing,
            deprecated: true,
            updatedAt: timestamp,
            ...(audit.supersededBy ? { supersededBy: audit.supersededBy } : {}),
            ...(audit.supersededBy || audit.reason ? { supersededAt: timestamp } : {}),
            ...(audit.reason ? { supersedeReason: audit.reason } : {}),
        };
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
 * Batch size for one manifest read-modify-write cycle during bulk import. This
 * bounds the work per save, it is NOT a total ceiling — restore must not have
 * one, or a large journal cannot be restored at all.
 */
const IMPORT_BATCH_SIZE = 1000;

/**
 * Bulk import (Drive restore). Validates every record, skips ids already
 * present, writes the rest in batches. Fail-closed on garbage.
 *
 * Validation and batching are kept apart on purpose. The previous version sliced
 * to 1000 *before* comparing lengths, so a backup of 1001+ perfectly valid files
 * threw `Backup contains invalid memory file records` and could never be
 * restored. That was unreachable only because `buildMemorySnapshot` used to
 * export ten files regardless of store size; once export was fixed it became a
 * live ceiling that blamed the user's data for its own limit.
 */
export async function importMemoryFiles(records: unknown): Promise<{ imported: number; skipped: number }> {
    if (!Array.isArray(records)) throw new Error('Memory file records must be an array.');
    const valid = records.filter(isImportRecord);
    if (valid.length !== records.length) throw new Error('Backup contains invalid memory file records.');
    let imported = 0;
    let skipped = 0;
    for (let offset = 0; offset < valid.length; offset += IMPORT_BATCH_SIZE) {
        const batch = valid.slice(offset, offset + IMPORT_BATCH_SIZE);
        const result = await withFilesLock(async () => {
            const manifest = await loadManifest();
            let batchImported = 0;
            let batchSkipped = 0;
            for (const record of batch) {
                if (manifest[record.header.id]) {
                    batchSkipped += 1;
                    continue;
                }
                manifest[record.header.id] = record.header;
                await storageAdapter.setItem(bodyKey(record.header.id), record.content);
                batchImported += 1;
            }
            // Headers land in the same save as their bodies, so a crash leaves an
            // orphan body at worst — never a dangling header.
            await saveManifest(manifest);
            return { batchImported, batchSkipped };
        });
        imported += result.batchImported;
        skipped += result.batchSkipped;
    }
    return { imported, skipped };
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
