/**
 * Hindsight REST client — soft-fail, timed, device-executed.
 * Never throws into the chat/finish path: every public function returns
 * null/false and console.warns on failure (model: embeddingsTransport.ts).
 *
 * Wire contract verified against the local Hindsight container v0.9.1
 * (http://localhost:8888): the API is served under `/v1/default/banks/{bank_id}`
 * — retain = POST .../memories, recall = POST .../memories/recall,
 * reflect = POST .../reflect, health = GET /health.
 */
import { getHindsightConfig } from './hindsightConfig';

export interface HindsightRetainItem {
    content: string;
    timestamp: number;
    document_id: string;
}

export interface HindsightRecallHit {
    content: string;
    similarity: number;
    timestamp?: number;
    documentId?: string;
}

// retain is fire-and-forget on the finish path; the container's first retain
// of a new document_id runs a synchronous LLM extraction pass measured up to
// ~19s (idempotent fast upsert afterwards), so keep the timeout above that.
// On the populated 168-doc bank the container answers recall in 3.5-5.7s and
// reflect in 21-63s (quality-battery measurements, 2026-08-18); timeouts are
// ceilings, not target latencies, and must sit above those tails.
const TIMEOUTS = { recall: 10000, retain: 20000, reflect: 70000, health: 1500 } as const;

type ChangeListener = () => void;
const listeners = new Set<ChangeListener>();

export function subscribeHindsightChanges(listener: ChangeListener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function notifyHindsightChanged(): void {
    listeners.forEach((listener) => listener());
}

function bankPath(bank: string, suffix: string): string {
    return `/v1/default/banks/${encodeURIComponent(bank)}${suffix}`;
}

async function request(
    path: string,
    body: unknown,
    timeoutMs: number,
    method: 'POST' | 'GET' = 'POST'
): Promise<unknown | null> {
    const config = getHindsightConfig();
    if (!config.enabled) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(`${config.baseUrl}${path}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
            },
            body: method === 'POST' ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        });
        if (!response.ok) {
            console.warn(`Hindsight ${path} failed: ${response.status}`);
            return null;
        }
        return await response.json();
    } catch (error) {
        console.warn(`Hindsight ${path} unavailable:`, error);
        return null;
    } finally {
        clearTimeout(timer);
    }
}

export async function hindsightRetain(
    items: HindsightRetainItem[],
    opts: { bank?: string } = {}
): Promise<boolean> {
    if (items.length === 0) return false;
    const config = getHindsightConfig();
    if (!config.enabled) return false;
    const bank = opts.bank ?? config.bank;
    // MemoryItem.timestamp is an ISO 8601 datetime string on the wire.
    const wireItems = items.map((item) => ({
        content: item.content,
        timestamp: new Date(item.timestamp).toISOString(),
        document_id: item.document_id,
    }));
    const result = await request(
        bankPath(bank, '/memories'),
        { items: wireItems },
        TIMEOUTS.retain
    );
    if (result === null) return false;
    notifyHindsightChanged();
    return true;
}

export async function hindsightRecall(
    query: string,
    opts: { bank?: string; limit?: number; strategies?: string[] } = {}
): Promise<HindsightRecallHit[] | null> {
    if (!query.trim()) return null;
    const config = getHindsightConfig();
    if (!config.enabled) return null;
    const bank = opts.bank ?? config.bank;
    const body: Record<string, unknown> = {
        query: query.trim(),
        limit: opts.limit ?? 6,
    };
    if (opts.strategies) body.strategies = opts.strategies;
    const data = await request(
        bankPath(bank, '/memories/recall'),
        body,
        TIMEOUTS.recall
    );
    const hits = normalizeRecallResponse(data);
    return hits ? dedupeRecallHits(hits, Math.max(1, opts.limit ?? 6)) : null;
}

// The container returns ~90-100 recall hits regardless of `limit` and, without
// dedup, near-identical auto-extracted units (e.g. 20 "called Priya" variants)
// drown out distinct facts. Collapse near-duplicates by word-set Jaccard and
// cap to the requested limit so the context block and tool stay bounded.
const NEAR_DUP_JACCARD = 0.55;
const TOKEN_RE = /[a-z0-9]+/g;

function tokenSet(content: string): Set<string> {
    return new Set(content.toLowerCase().match(TOKEN_RE) ?? []);
}

function jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    let intersection = 0;
    a.forEach((token) => {
        if (b.has(token)) intersection += 1;
    });
    return intersection / (a.size + b.size - intersection);
}

export function dedupeRecallHits<T extends { content: string; similarity: number }>(
    hits: T[],
    limit?: number
): T[] {
    const sorted = [...hits].sort((x, y) => y.similarity - x.similarity);
    const kept: T[] = [];
    const keptTokens: Set<string>[] = [];
    for (const hit of sorted) {
        const tokens = tokenSet(hit.content);
        if (keptTokens.some((k) => jaccard(k, tokens) >= NEAR_DUP_JACCARD)) continue;
        kept.push(hit);
        keptTokens.push(tokens);
        if (limit !== undefined && kept.length >= limit) break;
    }
    return kept;
}

function readScoresFinal(scores: unknown): number {
    if (typeof scores !== 'object' || scores === null) return 0;
    const final = (scores as Record<string, unknown>).final;
    return typeof final === 'number' && Number.isFinite(final) ? final : 0;
}

function readRecallTimestamp(u: Record<string, unknown>): number | undefined {
    const direct = u.timestamp;
    if (typeof direct === 'number') return direct;
    const occurred = u.occurred_start;
    if (typeof occurred === 'string') {
        const ms = Date.parse(occurred);
        return Number.isNaN(ms) ? undefined : ms;
    }
    return undefined;
}

function normalizeRecallHit(unit: unknown): HindsightRecallHit {
    const u = (unit ?? {}) as Record<string, unknown>;
    const content =
        typeof u.content === 'string' ? u.content
        : typeof u.text === 'string' ? u.text
        : '';
    const similarity =
        typeof u.similarity === 'number'
            ? u.similarity
            : readScoresFinal(u.scores);
    const timestamp = readRecallTimestamp(u);
    const documentId =
        typeof u.document_id === 'string' ? u.document_id
        : typeof u.documentId === 'string' ? u.documentId
        : undefined;
    return { content, similarity, timestamp, documentId };
}

function normalizeRecallResponse(data: unknown): HindsightRecallHit[] | null {
    if (!data) return null;
    const record = data as Record<string, unknown>;
    const raw = Array.isArray(data)
        ? data
        : Array.isArray(record.units)
          ? record.units
          : Array.isArray(record.results)
            ? record.results
            : null;
    if (!raw) return null;
    return raw
        .map(normalizeRecallHit)
        .filter((hit) => hit.content.length > 0);
}

export async function hindsightReflect(
    query: string,
    opts: { bank?: string } = {}
): Promise<string | null> {
    if (!query.trim()) return null;
    const config = getHindsightConfig();
    if (!config.enabled) return null;
    const bank = opts.bank ?? config.bank;
    const data = await request(
        bankPath(bank, '/reflect'),
        { query: query.trim() },
        TIMEOUTS.reflect
    );
    if (typeof data === 'string') return data;
    if (data && typeof data === 'object') {
        const record = data as Record<string, unknown>;
        const reflection = record.reflection;
        if (typeof reflection === 'string') return reflection;
        const text = record.text;
        if (typeof text === 'string') return text;
    }
    return null;
}

export async function hindsightHealth(): Promise<boolean> {
    const config = getHindsightConfig();
    if (!config.enabled) return false;
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUTS.health);
        const response = await fetch(`${config.baseUrl}/health`, {
            method: 'GET',
            signal: controller.signal,
        });
        clearTimeout(timer);
        return response.ok;
    } catch {
        return false;
    }
}
