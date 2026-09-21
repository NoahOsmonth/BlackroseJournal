import {
    getMemoryRecordsByIds,
    getManifestStats,
    listMemoryFiles,
    listStagedSessionKeys,
    MEMORY_FILE_TYPES,
} from '@/services/memory/memoryFiles';
import type { MemoryFileType } from '@/services/memory/memoryFiles';
import { runMemoryDream } from '@/services/memory/memoryDream';
import { listEntries } from '@/services/journal/journalStorage';
import { listCompletedCheckIns } from '@/services/intentions/intentionsStorage';
import { stageCheckInMemoryFiles, stageJournalEntryMemoryFiles } from '@/services/memory/memoryStage';
import { RECALL_FILE_MAX_CHARS, RECALL_TOTAL_MAX_CHARS, retrieveMemory } from '@/services/memory/memoryRetrieval';
import type { ToolHandler } from './types';

/**
 * Bound on how many ids one call may ask for. The prompt cost is already bounded
 * by `MEMORY_GET_TOTAL_MAX_CHARS`; this bounds the per-body manifest/body reads.
 */
const MAX_MEMORY_GET_IDS = 10;

/**
 * Prompt-safety bounds for `memory_get`.
 *
 * The per-body bound is the recall block's own per-file budget, so a body read
 * through this tool is the same body recall would have shown; the per-call total
 * is the recall block's total budget, so ten ids cannot ask the model to read ten
 * whole files. Every bound here announces itself when it bites — an unnamed
 * `slice` is what this replaced.
 */
const MEMORY_GET_FILE_MAX_CHARS = RECALL_FILE_MAX_CHARS;
const MEMORY_GET_TOTAL_MAX_CHARS = RECALL_TOTAL_MAX_CHARS;

function asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        const n = Number(value);
        return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
}

/**
 * ClawX `memory_search`: gated recall over offline file memories.
 * Search first, then `memory_get` the exact ids you need to verify.
 */
export const memorySearchTool: ToolHandler = async (args) => {
    const query = asString(args.query);
    if (!query) return 'Error: query is required.';
    const result = await retrieveMemory(query, { mode: 'explicit' });
    if (!result.context) {
        return `No offline memory for "${query}" (route=${result.intent}). Do not invent memories.`;
    }
    const refs = result.debug.selectedFileIds.map((id) => `- ${id}`).join('\n');
    const disambiguation = result.intent === 'project_memory' && !result.debug.resolvedProjectId
        ? '\nNo formal thread matched — ask the user to clarify which thread they mean before answering thread-specific details.'
        : '';
    return [`${result.context}`, `refs:\n${refs}`, disambiguation].filter(Boolean).join('\n\n');
};

/**
 * Page size bounds for `memory_list`. The ceiling exists because this feeds a
 * prompt; it is named and announced rather than applied in silence, which is what
 * `Math.min(50, …)` did — a caller asking for 100 got 50 rows and no way to tell.
 */
const MEMORY_LIST_DEFAULT_LIMIT = 10;
const MEMORY_LIST_MAX_LIMIT = 50;

/** ClawX `memory_list`: header-only browse (never bodies). */
export const memoryListTool: ToolHandler = async (args) => {
    const kindRaw = asString(args.kind)?.toLowerCase() ?? 'all';
    // Derived, never a second copy of the list. A hardcoded allowlist here meant
    // a kind the store supports but this line does not know about fell through to
    // `all` — the tool answered a narrower question than it was asked, and said
    // nothing. `MEMORY_FILE_TYPES` is the store's own list, so the two cannot drift.
    const kind: 'all' | MemoryFileType = kindRaw === 'all'
        ? 'all'
        : (MEMORY_FILE_TYPES as readonly string[]).includes(kindRaw)
            ? (kindRaw as MemoryFileType)
            : 'all';
    const askedLimit = Math.max(1, Math.floor(asNumber(args.limit) ?? MEMORY_LIST_DEFAULT_LIMIT));
    const limit = Math.min(MEMORY_LIST_MAX_LIMIT, askedLimit);
    const offset = Math.max(0, Math.floor(asNumber(args.offset) ?? 0));
    const headers = await listMemoryFiles({
        kind,
        query: asString(args.query),
        projectId: asString(args.projectId),
        limit,
        offset,
    });
    if (headers.length === 0) return 'No memory files match. Nothing staged yet — finished entries stage memories automatically.';
    const rows = headers.map((h) => `- ${h.relativePath} [${h.type}] (${h.updatedAt}): ${h.description}`);
    return [
        ...rows,
        // A page and a complete list look identical otherwise, so say which this is.
        ...(askedLimit > MEMORY_LIST_MAX_LIMIT
            ? [`asked for ${askedLimit} row(s); this tool pages at most ${MEMORY_LIST_MAX_LIMIT} per call, showing rows ${offset}\u2013${offset + headers.length - 1}.`]
            : []),
        ...(headers.length === limit
            ? [`Showing ${headers.length} row(s) from offset ${offset}. Call again with offset ${offset + headers.length} if you need the rest.`]
            : []),
    ].join('\n');
};

/**
 * Clip one body to its share of the call's budget, saying so in the output.
 *
 * The previous bound was an unnamed `slice(0, 4000)`: a long memory came back cut
 * mid-sentence with nothing in the result to distinguish "this is the whole file"
 * from "this is the first 4000 characters". The model could not tell it was
 * missing the rest, so it answered as if it had the whole memory.
 */
function clipBody(content: string, allowed: number): { text: string; clipped: boolean } {
    if (content.length <= allowed) return { text: content, clipped: false };
    const kept = allowed > 0 ? `${content.slice(0, allowed).trimEnd()}\n\n` : '';
    const why = allowed > 0
        ? `${content.length - allowed} more char(s)`
        : `nothing loaded, this call's ${MEMORY_GET_TOTAL_MAX_CHARS}-char budget was already spent`;
    return { text: `${kept}…[truncated: ${why}]`, clipped: true };
}

/** ClawX `memory_get`: exact-id body loads for ids from search/list. */
export const memoryGetTool: ToolHandler = async (args) => {
    const raw = args.ids;
    const ids = Array.isArray(raw)
        ? raw.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean)
        : [];
    if (ids.length === 0) return 'Error: ids must contain at least one non-empty id from memory_search or memory_list.';
    const requested = ids.slice(0, MAX_MEMORY_GET_IDS);
    const records = await getMemoryRecordsByIds(requested);
    const found = new Set(records.map((r) => r.relativePath));
    const missing = requested.filter((id) => !found.has(id));
    let remaining = MEMORY_GET_TOTAL_MAX_CHARS;
    let clipped = 0;
    const bodies = records.map((r) => {
        const allowed = Math.max(0, Math.min(MEMORY_GET_FILE_MAX_CHARS, remaining));
        const body = clipBody(r.content, allowed);
        remaining -= body.text.length;
        if (body.clipped) clipped += 1;
        return `### [${r.type}] ${r.relativePath} (${r.updatedAt})\n${body.text}`;
    });
    return [
        `found: ${records.length}/${requested.length}`,
        // Lead with it: the model reads the first lines and may skim the bodies.
        ...(clipped
            ? [`clipped: ${clipped} of ${records.length} body(ies) exceeded ${MEMORY_GET_TOTAL_MAX_CHARS} chars for this call; each is marked inline with …[truncated] — do not treat a clipped body as complete.`]
            : []),
        ...bodies,
        ...(missing.length ? [`missing: ${missing.join(', ')}`] : []),
        // Never drop ids quietly: the model must know to re-issue for the rest.
        ...(ids.length > requested.length
            ? [`not loaded: ${ids.length - requested.length} further id(s) - this tool loads at most ${MAX_MEMORY_GET_IDS} bodies per call, re-issue for the rest.`]
            : []),
    ].join('\n\n');
};

/** ClawX `memory_overview`: counts, freshness, staging backlog. */
export const memoryOverviewTool: ToolHandler = async () => {
    const stats = await getManifestStats();
    return [
        'Offline memory status:',
        `- formal threads: ${stats.formalThreads} (${stats.formalFiles} files)`,
        `- staged awaiting Dream: ${stats.tmpFiles}`,
        `- user files: ${stats.userFiles}`,
        `- total live files: ${stats.totalFiles}`,
        `- last update: ${stats.lastUpdatedAt || 'never'}`,
    ].join('\n');
};

/** How many sessions one call may newly stage, per source (journal / check-in). */
const MAX_FLUSH_SESSIONS = 20;

interface FlushWalkOutcome {
    stagedSessions: number;
    stagedFiles: number;
    skipped: number;
    remaining: number;
}

/**
 * Stage unstaged sessions from one newest-first list, up to `budget` newly staged
 * sessions.
 *
 * The budget counts sessions *staged*, not sessions *examined*. Capping the
 * examined slice is what made this tool stall: every call re-read the same newest
 * twenty, found them all already staged, and reported success — while the backlog
 * behind them was never reached, no matter how many times it was called. An
 * already-staged session now costs no budget, so repeated calls walk the backlog
 * down instead of staring at its head.
 */
async function stageUnstagedSessions<T>(
    items: readonly T[],
    stagedKeys: ReadonlySet<string>,
    idOf: (item: T) => string,
    stage: (item: T) => Promise<readonly unknown[]>,
    budget: number,
): Promise<FlushWalkOutcome> {
    let stagedSessions = 0;
    let stagedFiles = 0;
    let skipped = 0;
    let index = 0;
    for (; index < items.length; index += 1) {
        if (stagedKeys.has(idOf(items[index]))) {
            skipped += 1;
            continue;
        }
        if (stagedSessions >= budget) break;
        const created = await stage(items[index]);
        // Nothing stageable (no user text): not progress, but not a reason to stop
        // scanning either — later sessions in the list may still have work.
        if (created.length === 0) continue;
        stagedSessions += 1;
        stagedFiles += created.length;
    }
    let remaining = 0;
    for (let i = index; i < items.length; i += 1) {
        if (!stagedKeys.has(idOf(items[i]))) remaining += 1;
    }
    return { stagedSessions, stagedFiles, skipped, remaining };
}

/** ClawX `memory_flush`: stage recent finished sessions missing staged files. */
export const memoryFlushTool: ToolHandler = async () => {
    // Both stores list newest first. One staged-key read rather than one manifest
    // parse per candidate.
    const [entries, checkIns, stagedKeys] = await Promise.all([
        listEntries('completed'),
        listCompletedCheckIns(),
        listStagedSessionKeys(),
    ]);
    const journal = await stageUnstagedSessions(
        entries, stagedKeys, (entry) => entry.id, stageJournalEntryMemoryFiles, MAX_FLUSH_SESSIONS,
    );
    const checkIn = await stageUnstagedSessions(
        checkIns, stagedKeys, (item) => item.id, stageCheckInMemoryFiles, MAX_FLUSH_SESSIONS,
    );
    const stagedFiles = journal.stagedFiles + checkIn.stagedFiles;
    const stagedSessions = journal.stagedSessions + checkIn.stagedSessions;
    const skipped = journal.skipped + checkIn.skipped;
    const remaining = journal.remaining + checkIn.remaining;
    return [
        `Memory flush: staged ${stagedFiles} file(s) from ${stagedSessions} session(s); ${skipped} session(s) already staged.`,
        // Same doctrine as `memory_get`: a backlog left behind is reported, not
        // silently re-attempted forever.
        remaining > 0
            ? `${remaining} session(s) still unstaged - call memory_flush again to keep draining the backlog.`
            : '',
        'Run memory_dream to consolidate staged files into threads.',
    ].filter(Boolean).join(' ');
};

/** ClawX `memory_dream`: consolidate staged files into formal threads. */
export const memoryDreamTool: ToolHandler = async () => {
    const outcome = await runMemoryDream({ tryLlm: true });
    return outcome.summary;
};
