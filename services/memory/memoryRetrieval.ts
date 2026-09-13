import {
    getMemoryRecordsByIds,
    listFormalProjectIds,
    listMemoryFiles,
} from './memoryFiles';

/**
 * ClawX-model gated recall, lexical edition (no embeddings).
 *
 *   route(Q) → none | user | project_memory
 *   project_memory → thread shortlist (lexical, top-5) → manifest scan
 *     → top-K select → body load with budgets → render context
 *
 * Budgets are load-bearing on free-model context windows:
 * 12k chars/file, 30k total, top-K 5, 30s cache.
 */

export type MemoryRoute = 'none' | 'user' | 'project_memory';

export interface MemoryRetrievalTraceStep {
    step: string;
    status: 'info' | 'success' | 'warning' | 'skipped';
    input: string;
    output: string;
}

export interface MemoryRetrievalResult {
    query: string;
    intent: MemoryRoute;
    context: string;
    trace: MemoryRetrievalTraceStep[];
    debug: {
        mode: 'lexical' | 'none';
        cacheHit: boolean;
        route: MemoryRoute;
        manifestCount: number;
        selectedFileIds: string[];
        resolvedProjectId?: string;
    };
}

export const RECALL_FILE_MAX_CHARS = 12000;
export const RECALL_TOTAL_MAX_CHARS = 30000;
export const RECALL_TOP_K = 5;
const RECALL_CACHE_TTL_MS = 30000;

const SMALLTALK_PATTERN = /^(hi|hey|hello|yo|thanks|thank you|ok|okay|cool|nice|bye|good (morning|night|evening))\b[.! ]*$/i;
const USER_ROUTE_PATTERN = /(my name|call me|pronouns|prefer to be called|about me|my profile|i live in|i work as|my (wife|husband|partner|kid|kids|family|dog|cat))/i;

interface CacheEntry {
    expiresAt: number;
    result: MemoryRetrievalResult;
}

const recallCache = new Map<string, CacheEntry>();

export function clearMemoryRecallCache(): void {
    recallCache.clear();
}

function normalizeQuery(query: string): string {
    return query.toLowerCase().replace(/\s+/g, ' ').trim();
}

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .split(/[\s/_-]+/)
        .map((t) => t.replace(/[^a-z0-9']/g, ''))
        .filter((t) => t.length >= 3);
}

function decideRoute(query: string): MemoryRoute {
    const trimmed = query.trim();
    if (!trimmed || SMALLTALK_PATTERN.test(trimmed)) return 'none';
    if (USER_ROUTE_PATTERN.test(trimmed)) return 'user';
    return 'project_memory';
}

function scoreThread(projectId: string, tokens: string[]): number {
    const identity = projectId.toLowerCase().replace(/_/g, ' ');
    let score = 0;
    const joined = tokens.join(' ');
    if (joined.includes(identity) || identity.includes(joined) && joined.length >= 4) score += 10;
    for (const token of tokens) {
        if (identity.includes(token)) score += 2;
    }
    return score;
}

function truncateBody(content: string, allowed: number): { text: string; truncated: boolean } {
    if (content.length <= allowed) return { text: content, truncated: false };
    return { text: `${content.slice(0, allowed).trimEnd()}\n\n…[truncated for recall budget]`, truncated: true };
}

export async function retrieveMemory(
    rawQuery: string,
    options: { mode?: 'auto' | 'explicit' } = {},
): Promise<MemoryRetrievalResult> {
    const query = rawQuery.trim();
    const mode = options.mode ?? 'explicit';
    const trace: MemoryRetrievalTraceStep[] = [
        { step: 'recall_start', status: 'info', input: query, output: `mode=${mode}` },
    ];

    const empty = (intent: MemoryRoute, output: string): MemoryRetrievalResult => ({
        query,
        intent,
        context: '',
        trace: [...trace, { step: 'recall_skipped', status: 'skipped', input: `route=${intent}`, output }],
        debug: { mode: 'none', cacheHit: false, route: intent, manifestCount: 0, selectedFileIds: [] },
    });

    if (!query) return empty('none', 'Empty query needs no memory.');

    const cacheKey = JSON.stringify({ q: normalizeQuery(query), mode });
    const cached = recallCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return {
            ...cached.result,
            debug: { ...cached.result.debug, cacheHit: true },
        };
    }

    let route = decideRoute(query);
    trace.push({ step: 'memory_gate', status: route === 'none' ? 'skipped' : 'success', input: query, output: `route=${route}` });
    if (route === 'none') {
        const result = empty('none', 'This query does not need long-term memory.');
        recallCache.set(cacheKey, { expiresAt: Date.now() + RECALL_CACHE_TTL_MS, result });
        return result;
    }

    const tokens = tokenize(query);

    if (route === 'user') {
        const headers = await listMemoryFiles({ kind: 'user', limit: RECALL_TOP_K });
        trace.push({ step: 'manifest_scanned', status: headers.length ? 'success' : 'warning', input: 'kind=user', output: `${headers.length} user files` });
        const records = await getMemoryRecordsByIds(headers.map((h) => h.id));
        const context = renderContext(route, undefined, records.map((r) => ({ path: r.relativePath, type: r.type, updatedAt: r.updatedAt, content: r.content })));
        const result: MemoryRetrievalResult = {
            query,
            intent: route,
            context,
            trace: [...trace, { step: 'context_rendered', status: context ? 'success' : 'warning', input: `${records.length} files`, output: context ? 'User context prepared.' : 'No user memory yet.' }],
            debug: { mode: context ? 'lexical' : 'none', cacheHit: false, route, manifestCount: headers.length, selectedFileIds: records.map((r) => r.id) },
        };
        recallCache.set(cacheKey, { expiresAt: Date.now() + RECALL_CACHE_TTL_MS, result });
        return result;
    }

    // project_memory: exact thread-name mention overrides scoring ties.
    const projectIds = await listFormalProjectIds();
    const ranked = projectIds
        .map((projectId) => ({ projectId, score: scoreThread(projectId, tokens) }))
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    const exact = ranked.filter((row) => normalizeQuery(query).includes(row.projectId.toLowerCase().replace(/_/g, ' ')));
    const resolvedProjectId = (exact.length === 1 ? exact[0]?.projectId : ranked[0]?.projectId) ?? '';
    trace.push({
        step: 'project_selected',
        status: resolvedProjectId ? 'success' : 'warning',
        input: `${projectIds.length} formal threads`,
        output: resolvedProjectId ? `project_id=${resolvedProjectId}` : 'No formal thread selected.',
    });

    if (!resolvedProjectId) {
        // Fall back to recency across all project/feedback files (still offline, still bounded).
        const headers = await listMemoryFiles({ limit: RECALL_TOP_K });
        const records = await getMemoryRecordsByIds(headers.map((h) => h.id));
        const context = renderContext(route, undefined, records.map((r) => ({ path: r.relativePath, type: r.type, updatedAt: r.updatedAt, content: r.content })), true);
        const result: MemoryRetrievalResult = {
            query,
            intent: route,
            context,
            trace: [...trace, { step: 'context_rendered', status: 'warning', input: `${records.length} files`, output: 'No thread resolved; recency fallback.' }],
            debug: { mode: 'lexical', cacheHit: false, route, manifestCount: headers.length, selectedFileIds: records.map((r) => r.id) },
        };
        recallCache.set(cacheKey, { expiresAt: Date.now() + RECALL_CACHE_TTL_MS, result });
        return result;
    }

    const manifest = await listMemoryFiles({ projectId: resolvedProjectId, limit: 200 });
    trace.push({ step: 'manifest_scanned', status: manifest.length ? 'success' : 'warning', input: `project_id=${resolvedProjectId}`, output: `${manifest.length} header entries` });

    const selected = manifest
        .map((header) => {
            const hay = `${header.name} ${header.description}`.toLowerCase();
            const score = tokens.reduce((total, token) => total + (hay.includes(token) ? 1 : 0), 0);
            return { header, score };
        })
        .sort((a, b) => b.score - a.score || b.header.updatedAt.localeCompare(a.header.updatedAt))
        .slice(0, RECALL_TOP_K);

    const records = await getMemoryRecordsByIds(selected.map((row) => row.header.id));
    trace.push({ step: 'files_loaded', status: records.length ? 'success' : 'warning', input: `${selected.length} requested`, output: `${records.length} files loaded.` });

    const context = renderContext(route, resolvedProjectId, records.map((r) => ({ path: r.relativePath, type: r.type, updatedAt: r.updatedAt, content: r.content })));
    const result: MemoryRetrievalResult = {
        query,
        intent: route,
        context,
        trace: [...trace, { step: 'context_rendered', status: context ? 'success' : 'warning', input: `${records.length} files`, output: context ? 'Memory context prepared.' : 'No memory context.' }],
        debug: {
            mode: context ? 'lexical' : 'none',
            cacheHit: false,
            route,
            manifestCount: manifest.length,
            selectedFileIds: records.map((r) => r.id),
            resolvedProjectId,
        },
    };
    recallCache.set(cacheKey, { expiresAt: Date.now() + RECALL_CACHE_TTL_MS, result });
    return result;
}

function renderContext(
    route: MemoryRoute,
    projectId: string | undefined,
    records: { path: string; type: string; updatedAt: string; content: string }[],
    disambiguation = false,
): string {
    if (records.length === 0 && !disambiguation) return '';
    const lines = ['## Offline Memory Recall', `route=${route}`];
    if (projectId) lines.push(`project_id: ${projectId}`);
    lines.push('');
    if (disambiguation) {
        lines.push(
            '## Thread Clarification',
            '- No formal memory thread matched this query.',
            '- Showing recent memories only — do not invent thread names.',
            '',
        );
    }
    let remaining = RECALL_TOTAL_MAX_CHARS;
    for (const record of records) {
        if (remaining <= 0) break;
        const allowed = Math.max(0, Math.min(RECALL_FILE_MAX_CHARS, remaining));
        if (allowed <= 0) break;
        const { text } = truncateBody(record.content, allowed);
        lines.push(`### [${record.type}] ${record.path} (${record.updatedAt})`, text, '');
        remaining -= text.length;
    }
    lines.push('Treat these file memories as the authoritative offline long-term memory for this turn when relevant.');
    return lines.join('\n').trim();
}
