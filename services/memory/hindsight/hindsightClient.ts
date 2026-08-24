/** Authenticated, bankless Hindsight gateway client. All operations soft-fail. */
import {
    parseMemoryClearResponse, parseMemoryRecallResponse, parseMemoryReflectResponse,
    parseMemoryRebuildResponse, parseMemoryRetainResponse,
    type MemoryMetadata, type MemoryRebuildItem,
} from '@blackrose/ai-control-plane-contracts';
import {
    getActiveAccountId, runAccountBoundOperation, type AccountOperationContext,
} from '@/services/account/accountRuntime';
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
    context: AccountOperationContext, expectedAccountId?: string,
): Promise<unknown | null> {
    const config = getHindsightConfig();
    if (!config.enabled) return null;
    const session = await sessionProvider().catch(() => null);
    if (!session || !isCurrentAccount(context, session.userId, expectedAccountId)) return null;
    const controller = new AbortController();
    const abortForAccountSwitch = () => controller.abort();
    context.signal.addEventListener('abort', abortForAccountSwitch);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(`${config.baseUrl}${path}`, {
            method,
            headers: { Accept: 'application/json', Authorization: `Bearer ${session.accessToken}`,
                ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
            ...(method === 'POST' ? { body: JSON.stringify(body) } : {}), signal: controller.signal,
        });
        if (!response.ok || !isCurrentAccount(context, session.userId, expectedAccountId)) return null;
        const data: unknown = await response.json();
        return isCurrentAccount(context, session.userId, expectedAccountId) ? data : null;
    } catch (error) {
        if (!context.signal.aborted) {
            console.warn(`Hindsight gateway ${path} unavailable:`, error);
        }
        return null;
    } finally {
        clearTimeout(timer);
        context.signal.removeEventListener('abort', abortForAccountSwitch);
    }
}

function isCurrentAccount(
    context: AccountOperationContext,
    sessionAccountId: string,
    expectedAccountId?: string,
): boolean {
    if (context.signal.aborted) return false;
    if (context.accountId && sessionAccountId !== context.accountId) return false;
    if (expectedAccountId && sessionAccountId !== expectedAccountId) return false;
    const activeAccountId = getActiveAccountId();
    return !context.accountId || activeAccountId === context.accountId;
}

async function runHindsightOperation<T>(
    owner: string,
    fallback: T,
    operation: (context: AccountOperationContext) => Promise<T>,
): Promise<T> {
    try {
        return await runAccountBoundOperation(owner, operation);
    } catch {
        return fallback;
    }
}

function inferMetadata(item: HindsightRetainItem): MemoryMetadata | undefined {
    const match = /^(journal_entry|intention_checkin):(.+)$/.exec(item.document_id);
    if (!match) return undefined;
    return { source: match[1] === 'journal_entry' ? 'journal' : 'check_in', sourceId: match[2],
        completed: true, writtenAt: new Date(item.timestamp).toISOString() };
}

export async function hindsightRetain(items: HindsightRetainItem[]): Promise<boolean> {
    if (items.length === 0) return false;
    return runHindsightOperation('hindsight-retain', false, async (context) => {
        for (const item of items) {
            const metadata = inferMetadata(item);
            const data = await request('/v1/memory/retain', {
                documentId: item.document_id, content: item.content,
                createdAt: new Date(item.timestamp).toISOString(), ...(metadata ? { metadata } : {}),
            }, TIMEOUTS.retain, 'POST', context);
            try { if (!parseMemoryRetainResponse(data).retained) return false; } catch { return false; }
        }
        if (context.signal.aborted) return false;
        notifyHindsightChanged(); return true;
    });
}

export async function hindsightRecall(query: string, opts: { limit?: number } = {}): Promise<HindsightRecallHit[] | null> {
    if (!query.trim()) return null;
    return runHindsightOperation('hindsight-recall', null, async (context) => {
        const data = await request('/v1/memory/recall', {
            query: query.trim(), limit: opts.limit ?? 6,
        }, TIMEOUTS.recall, 'POST', context);
        try {
            const hits = parseMemoryRecallResponse(data).results.map((result) => ({
                content: result.content, similarity: result.score, documentId: result.documentId,
                ...(result.metadata?.writtenAt ? { timestamp: Date.parse(result.metadata.writtenAt) } : {}),
            }));
            return context.signal.aborted
                ? null : dedupeRecallHits(hits, Math.max(1, opts.limit ?? 6));
        } catch { return null; }
    });
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
    return runHindsightOperation('hindsight-reflect', null, async (context) => {
        const data = await request('/v1/memory/reflect', {
            query: query.trim(),
        }, TIMEOUTS.reflect, 'POST', context);
        try {
            return context.signal.aborted ? null : parseMemoryReflectResponse(data).reflection;
        } catch { return null; }
    });
}

export async function hindsightRebuild(items: HindsightRetainItem[], expectedAccountId?: string): Promise<boolean> {
    if (items.length === 0) return hindsightClear(expectedAccountId);
    const records: MemoryRebuildItem[] = items.map((item) => {
        const metadata = inferMetadata(item);
        return { documentId: item.document_id, kind: metadata?.source === 'check_in' ? 'check_in' : 'journal',
            content: item.content, createdAt: new Date(item.timestamp).toISOString(),
            ...(metadata ? { metadata } : {}) };
    });
    return runHindsightOperation('hindsight-rebuild', false, async (context) => {
        const data = await request('/v1/memory/rebuild', {
            items: records,
        }, TIMEOUTS.rebuild, 'POST', context, expectedAccountId);
        try {
            const succeeded = !context.signal.aborted
                && parseMemoryRebuildResponse(data).accepted === records.length;
            if (succeeded) notifyHindsightChanged();
            return succeeded;
        } catch { return false; }
    });
}

export async function hindsightClear(expectedAccountId?: string): Promise<boolean> {
    return runHindsightOperation('hindsight-clear', false, async (context) => {
        const data = await request(
            '/v1/memory', undefined, TIMEOUTS.clear, 'DELETE', context, expectedAccountId
        );
        try {
            const succeeded = !context.signal.aborted && parseMemoryClearResponse(data).cleared;
            if (succeeded) notifyHindsightChanged();
            return succeeded;
        } catch { return false; }
    });
}

export async function hindsightHealth(): Promise<boolean> {
    return Boolean(getHindsightConfig().enabled && await sessionProvider().catch(() => null));
}
