/** Authenticated, bankless Hindsight gateway client. All operations soft-fail. */
import {
    parseMemoryClearResponse, parseMemoryRecallResponse, parseMemoryReflectResponse,
    parseMemoryRebuildResponse, parseMemoryRetainResponse,
    type MemoryMetadata, type MemoryRebuildItem,
} from '@blackrose/ai-control-plane-contracts';
import { getActiveAccountId } from '@/services/account/accountRuntime';
import { getSupabaseClient } from '@/services/supabase/supabaseClient';
import { getHindsightConfig } from './hindsightConfig';

export interface HindsightRetainItem { content: string; timestamp: number; document_id: string }
export interface HindsightRecallHit { content: string; similarity: number; timestamp?: number; documentId?: string }
interface HindsightSession { accessToken: string; userId: string }
type HindsightSessionProvider = () => Promise<HindsightSession | null>;
const TIMEOUTS = { recall: 10000, retain: 20000, reflect: 70000, rebuild: 70000, clear: 10000 } as const;
type ChangeListener = () => void;
const listeners = new Set<ChangeListener>();

const defaultSessionProvider: HindsightSessionProvider = async () => {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error || !data.session || data.session.user.is_anonymous) return null;
    return { accessToken: data.session.access_token, userId: data.session.user.id };
};
let sessionProvider: HindsightSessionProvider = defaultSessionProvider;
export function setHindsightSessionProvider(provider: HindsightSessionProvider): void { sessionProvider = provider; }
export function resetHindsightSessionProvider(): void { sessionProvider = defaultSessionProvider; }
export function subscribeHindsightChanges(listener: ChangeListener): () => void {
    listeners.add(listener); return () => { listeners.delete(listener); };
}
export function notifyHindsightChanged(): void { listeners.forEach((listener) => listener()); }

async function request(
    path: string, body: unknown, timeoutMs: number, method: 'POST' | 'DELETE' = 'POST',
    expectedAccountId?: string,
): Promise<unknown | null> {
    const config = getHindsightConfig();
    if (!config.enabled) return null;
    const session = await sessionProvider().catch(() => null);
    const activeAccountId = getActiveAccountId();
    if (!session || (activeAccountId && session.userId !== activeAccountId)
        || (expectedAccountId && session.userId !== expectedAccountId)) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(`${config.baseUrl}${path}`, {
            method,
            headers: { Accept: 'application/json', Authorization: `Bearer ${session.accessToken}`,
                ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
            ...(method === 'POST' ? { body: JSON.stringify(body) } : {}), signal: controller.signal,
        });
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.warn(`Hindsight gateway ${path} unavailable:`, error);
        return null;
    } finally { clearTimeout(timer); }
}

function inferMetadata(item: HindsightRetainItem): MemoryMetadata | undefined {
    const match = /^(journal_entry|intention_checkin):(.+)$/.exec(item.document_id);
    if (!match) return undefined;
    return { source: match[1] === 'journal_entry' ? 'journal' : 'check_in', sourceId: match[2],
        completed: true, writtenAt: new Date(item.timestamp).toISOString() };
}

export async function hindsightRetain(items: HindsightRetainItem[]): Promise<boolean> {
    if (items.length === 0) return false;
    for (const item of items) {
        const metadata = inferMetadata(item);
        const data = await request('/v1/memory/retain', {
            documentId: item.document_id, content: item.content,
            createdAt: new Date(item.timestamp).toISOString(), ...(metadata ? { metadata } : {}),
        }, TIMEOUTS.retain);
        try { if (!parseMemoryRetainResponse(data).retained) return false; } catch { return false; }
    }
    notifyHindsightChanged(); return true;
}

export async function hindsightRecall(query: string, opts: { limit?: number } = {}): Promise<HindsightRecallHit[] | null> {
    if (!query.trim()) return null;
    const data = await request('/v1/memory/recall', { query: query.trim(), limit: opts.limit ?? 6 }, TIMEOUTS.recall);
    try {
        const hits = parseMemoryRecallResponse(data).results.map((result) => ({
            content: result.content, similarity: result.score, documentId: result.documentId,
            ...(result.metadata?.writtenAt ? { timestamp: Date.parse(result.metadata.writtenAt) } : {}),
        }));
        return dedupeRecallHits(hits, Math.max(1, opts.limit ?? 6));
    } catch { return null; }
}

const NEAR_DUP_JACCARD = 0.55;
const TOKEN_RE = /[a-z0-9]+/g;
function tokenSet(content: string): Set<string> { return new Set(content.toLowerCase().match(TOKEN_RE) ?? []); }
function jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    let intersection = 0;
    a.forEach((token) => { if (b.has(token)) intersection += 1; });
    return intersection / (a.size + b.size - intersection);
}
export function dedupeRecallHits<T extends { content: string; similarity: number }>(hits: T[], limit?: number): T[] {
    const kept: T[] = []; const keptTokens: Set<string>[] = [];
    for (const hit of [...hits].sort((a, b) => b.similarity - a.similarity)) {
        const tokens = tokenSet(hit.content);
        if (keptTokens.some((existing) => jaccard(existing, tokens) >= NEAR_DUP_JACCARD)) continue;
        kept.push(hit); keptTokens.push(tokens);
        if (limit !== undefined && kept.length >= limit) break;
    }
    return kept;
}

export async function hindsightReflect(query: string): Promise<string | null> {
    if (!query.trim()) return null;
    const data = await request('/v1/memory/reflect', { query: query.trim() }, TIMEOUTS.reflect);
    try { return parseMemoryReflectResponse(data).reflection; } catch { return null; }
}

export async function hindsightRebuild(items: HindsightRetainItem[], expectedAccountId?: string): Promise<boolean> {
    if (items.length === 0) return hindsightClear(expectedAccountId);
    const records: MemoryRebuildItem[] = items.map((item) => {
        const metadata = inferMetadata(item);
        return { documentId: item.document_id, kind: metadata?.source === 'check_in' ? 'check_in' : 'journal',
            content: item.content, createdAt: new Date(item.timestamp).toISOString(),
            ...(metadata ? { metadata } : {}) };
    });
    const data = await request('/v1/memory/rebuild', { items: records }, TIMEOUTS.rebuild, 'POST', expectedAccountId);
    try {
        const succeeded = parseMemoryRebuildResponse(data).accepted === records.length;
        if (succeeded) notifyHindsightChanged();
        return succeeded;
    } catch { return false; }
}

export async function hindsightClear(expectedAccountId?: string): Promise<boolean> {
    const data = await request('/v1/memory', undefined, TIMEOUTS.clear, 'DELETE', expectedAccountId);
    try {
        const succeeded = parseMemoryClearResponse(data).cleared;
        if (succeeded) notifyHindsightChanged();
        return succeeded;
    } catch { return false; }
}

export async function hindsightHealth(): Promise<boolean> {
    return Boolean(getHindsightConfig().enabled && await sessionProvider().catch(() => null));
}
