import { fetchDirectJsonCompletion, parseJsonFromModelText } from '@/services/ai/jsonCompletion';
import {
    getMemoryRecordsByIds,
    listTmpFiles,
    promoteTmpRecord,
} from './memoryFiles';
import type { MemoryFileHeader } from './memoryFiles';

/**
 * Dream consolidation (ClawX Dream, lexical edition).
 *
 * Promotes `_tmp` staged files into formal thread projects. Merge discipline:
 * distinct thread hints stay separate (anti-umbrella rule); only exact body
 * duplicates collapse. An LLM plan is attempted first via
 * `fetchDirectJsonCompletion`; any failure falls back to the deterministic
 * thread-hint clustering — Dream works fully offline.
 */

export interface DreamPlanThread {
    threadId: string;
    name: string;
    fileIds: string[];
}

export interface DreamOutcome {
    promoted: number;
    threads: string[];
    tmpRemaining: number;
    summary: string;
    usedLlm: boolean;
}

const MAX_DREAM_FILES = 20;

function slugThread(value: string): string {
    const slug = value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-+|-+$/g, '');
    return slug.slice(0, 60) || 'general';
}

function threadHintOf(header: MemoryFileHeader): string | null {
    const match = /Thread hint ([a-z0-9\u4e00-\u9fff_-]+)\./i.exec(header.description);
    return match?.[1] ? slugThread(match[1]) : null;
}

function hashBody(body: string): string {
    let hash = 0;
    for (let i = 0; i < body.length; i += 1) {
        hash = (hash * 31 + body.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(36);
}

/** Deterministic fallback: group by staging thread hint, loners by name slug. */
export function clusterTmpFiles(headers: readonly MemoryFileHeader[]): DreamPlanThread[] {
    const groups = new Map<string, MemoryFileHeader[]>();
    headers.forEach((header) => {
        const key = threadHintOf(header) ?? `solo-${slugThread(header.name)}`;
        const group = groups.get(key) ?? [];
        group.push(header);
        groups.set(key, group);
    });
    return Array.from(groups.entries()).map(([threadId, files]) => ({
        threadId,
        name: files[0]?.name ?? threadId,
        fileIds: files.map((f) => f.id),
    }));
}

function validateLlmPlan(raw: unknown, tmpIds: Set<string>): DreamPlanThread[] | null {
    if (typeof raw !== 'object' || raw === null) return null;
    const threads = (raw as { threads?: unknown }).threads;
    if (!Array.isArray(threads) || threads.length === 0) return null;
    const seen = new Set<string>();
    const plan: DreamPlanThread[] = [];
    for (const item of threads) {
        if (typeof item !== 'object' || item === null) return null;
        const rec = item as Record<string, unknown>;
        const threadId = typeof rec.threadId === 'string' ? slugThread(rec.threadId) : '';
        const name = typeof rec.name === 'string' ? rec.name.trim().slice(0, 120) : '';
        const fileIds = Array.isArray(rec.fileIds)
            ? rec.fileIds.filter((v): v is string => typeof v === 'string')
            : [];
        if (!threadId || !name || fileIds.length === 0) return null;
        if (!fileIds.every((id) => tmpIds.has(id) && !seen.has(id))) return null;
        fileIds.forEach((id) => seen.add(id));
        plan.push({ threadId, name, fileIds });
    }
    // Every tmp file must be assigned exactly once — fail closed otherwise.
    if (seen.size !== tmpIds.size) return null;
    return plan;
}

const DREAM_PLAN_PROMPT = [
    'You organize staged journal memory files into thread projects.',
    'Rules: use only the supplied files. Distinct topics stay separate — never merge into an umbrella thread unless files clearly describe the same ongoing thread. Every file id appears exactly once.',
    'Return JSON only: {"threads":[{"threadId":"lower-kebab-slug","name":"Thread name","fileIds":["<id>", ...]}]}',
].join('\n');

async function proposePlanWithLlm(
    headers: readonly MemoryFileHeader[],
    bodies: Map<string, string>,
): Promise<DreamPlanThread[] | null> {
    try {
        const files = headers.map((h) => ({
            id: h.id,
            name: h.name,
            description: h.description.slice(0, 220),
            body: (bodies.get(h.id) ?? '').slice(0, 400),
        }));
        const { content } = await fetchDirectJsonCompletion({
            messages: [
                { role: 'system', content: DREAM_PLAN_PROMPT },
                { role: 'user', content: JSON.stringify({ files }) },
            ],
            max_tokens: 1500,
        });
        const parsed: unknown = parseJsonFromModelText(content);
        return validateLlmPlan(parsed, new Set(headers.map((h) => h.id)));
    } catch {
        return null;
    }
}

export async function runMemoryDream(options: { tryLlm?: boolean } = {}): Promise<DreamOutcome> {
    const tmp = (await listTmpFiles()).slice(0, MAX_DREAM_FILES);
    if (tmp.length === 0) {
        return { promoted: 0, threads: [], tmpRemaining: 0, summary: 'No staged memories to consolidate.', usedLlm: false };
    }
    const records = await getMemoryRecordsByIds(tmp.map((t) => t.id));
    const bodies = new Map(records.map((r) => [r.id, r.content]));

    let plan: DreamPlanThread[] | null = null;
    let usedLlm = false;
    if (options.tryLlm !== false) {
        plan = await proposePlanWithLlm(tmp, bodies);
        usedLlm = plan !== null;
    }
    plan ??= clusterTmpFiles(tmp);

    // Collapse exact body duplicates inside each thread before promoting.
    // (Scoped per thread: the same session staged under two topics keeps
    // both threads, but never the same bytes twice in one thread.)
    let promoted = 0;
    const threads: string[] = [];
    for (const thread of plan) {
        const seenBodies = new Set<string>();
        let threadPromoted = 0;
        for (const fileId of thread.fileIds) {
            const body = bodies.get(fileId) ?? '';
            const digest = hashBody(body);
            if (seenBodies.has(digest)) continue;
            seenBodies.add(digest);
            const header = await promoteTmpRecord(fileId, thread.threadId);
            if (header) {
                promoted += 1;
                threadPromoted += 1;
            }
        }
        if (threadPromoted > 0) threads.push(thread.threadId);
    }
    const remaining = (await listTmpFiles()).length;
    return {
        promoted,
        threads,
        tmpRemaining: remaining,
        summary: `Dream ${usedLlm ? '(LLM plan)' : '(offline plan)'}: promoted ${promoted} file(s) into ${threads.length} thread(s)${threads.length ? ` (${threads.join(', ')})` : ''}; ${remaining} staged file(s) remaining.`,
        usedLlm,
    };
}
