import {
    getMemoryRecordsByIds,
    getManifestStats,
    hasStagedSession,
    listMemoryFiles,
} from '@/services/memory/memoryFiles';
import type { MemoryFileType } from '@/services/memory/memoryFiles';
import { runMemoryDream } from '@/services/memory/memoryDream';
import { listEntries } from '@/services/journal/journalStorage';
import { listCompletedCheckIns } from '@/services/intentions/intentionsStorage';
import { stageCheckInMemoryFiles, stageJournalEntryMemoryFiles } from '@/services/memory/memoryStage';
import { retrieveMemory } from '@/services/memory/memoryRetrieval';
import type { ToolHandler } from './types';

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

/** ClawX `memory_list`: header-only browse (never bodies). */
export const memoryListTool: ToolHandler = async (args) => {
    const kindRaw = asString(args.kind)?.toLowerCase() ?? 'all';
    const kind: 'all' | MemoryFileType = kindRaw === 'user' || kindRaw === 'feedback' || kindRaw === 'project'
        ? kindRaw
        : 'all';
    const headers = await listMemoryFiles({
        kind,
        query: asString(args.query),
        projectId: asString(args.projectId),
        limit: Math.min(50, Math.max(1, Math.floor(asNumber(args.limit) ?? 10))),
        offset: Math.max(0, Math.floor(asNumber(args.offset) ?? 0)),
    });
    if (headers.length === 0) return 'No memory files match. Nothing staged yet — finished entries stage memories automatically.';
    return headers
        .map((h) => `- ${h.relativePath} [${h.type}] (${h.updatedAt}): ${h.description}`)
        .join('\n');
};

/** ClawX `memory_get`: exact-id body loads for ids from search/list. */
export const memoryGetTool: ToolHandler = async (args) => {
    const raw = args.ids;
    const ids = Array.isArray(raw)
        ? raw.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean)
        : [];
    if (ids.length === 0) return 'Error: ids must contain at least one non-empty id from memory_search or memory_list.';
    const records = await getMemoryRecordsByIds(ids);
    const found = new Set(records.map((r) => r.relativePath));
    const missing = ids.filter((id) => !found.has(id));
    const bodies = records.map((r) => `### [${r.type}] ${r.relativePath} (${r.updatedAt})\n${r.content.slice(0, 4000)}`);
    return [
        `found: ${records.length}/${ids.length}`,
        ...bodies,
        ...(missing.length ? [`missing: ${missing.join(', ')}`] : []),
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

const MAX_FLUSH_SESSIONS = 20;

/** ClawX `memory_flush`: stage recent finished sessions missing staged files. */
export const memoryFlushTool: ToolHandler = async () => {
    const entries = (await listEntries('completed')).slice(0, MAX_FLUSH_SESSIONS);
    const checkIns = (await listCompletedCheckIns()).slice(0, MAX_FLUSH_SESSIONS);
    let staged = 0;
    let skipped = 0;
    for (const entry of entries) {
        if (await hasStagedSession(entry.id)) {
            skipped += 1;
            continue;
        }
        staged += (await stageJournalEntryMemoryFiles(entry)).length;
    }
    for (const checkIn of checkIns) {
        if (await hasStagedSession(checkIn.id)) {
            skipped += 1;
            continue;
        }
        staged += (await stageCheckInMemoryFiles(checkIn)).length;
    }
    return `Memory flush: staged ${staged} file(s); ${skipped} session(s) already staged. Run memory_dream to consolidate staged files into threads.`;
};

/** ClawX `memory_dream`: consolidate staged files into formal threads. */
export const memoryDreamTool: ToolHandler = async () => {
    const outcome = await runMemoryDream({ tryLlm: true });
    return outcome.summary;
};
