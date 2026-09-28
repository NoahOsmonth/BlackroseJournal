/**
 * Chat session persistence
 *
 * AsyncStorage-backed store of in-flight chat sessions. These are autosave /
 * crash-recovery artifacts, kept SEPARATE from journal drafts (which are an
 * explicit "save for later" user artifact). Sessions are auto-managed: keyed by
 * conversationId, pruned aggressively, and dropped on finish.
 *
 * Mirrors the storage-adapter + sanitize-on-read pattern from customModels.ts so
 * it is unit-testable and never throws to callers (returns safe defaults).
 */

import { accountScopedStorage as AsyncStorage } from '@/services/account/accountScopedStorage';
import { runAccountBoundOperation } from '@/services/account/accountRuntime';
import type { AgentToolCallOrigin, AgentToolCallSnapshot, AgentToolStatus } from './agentEvents';
import type { Message } from './chatTypes';
import { normalizeTemporalMessageMetadata } from './messageTemporalMetadata';

export type ChatSessionMode =
    | 'freeform'
    | 'dailyCheckIn'
    | 'continue'
    | 'intention'
    | 'morning'
    | 'evening';

export interface ChatSession {
    conversationId: string;
    mode: ChatSessionMode;
    messages: Message[];
    personaId?: string;
    /** Route params needed to faithfully resume (entryId, area, intentionId, type). */
    routeParams?: Record<string, string>;
    /** Typed-but-unsent composer text at save time (restored on resume). */
    composerDraft?: string;
    updatedAt: number;
    createdAt: number;
}

interface StorageAdapter {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
}

export const CHAT_SESSIONS_KEY = '@blackrose_chat_sessions';
const MAX_SESSIONS = 10;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const SESSION_MODES: ReadonlySet<ChatSessionMode> = new Set([
    'freeform',
    'dailyCheckIn',
    'continue',
    'intention',
    'morning',
    'evening',
]);

let storageAdapter: StorageAdapter = AsyncStorage;
let sessionMutationQueue: Promise<unknown> = Promise.resolve();

function withSessionMutation<T>(task: () => Promise<T>): Promise<T> {
    return runAccountBoundOperation('ai-session-storage', async () => {
        const run = sessionMutationQueue.then(task, task);
        sessionMutationQueue = run.catch(() => undefined);
        return run;
    });
}

export function setChatSessionStorageAdapter(adapter: StorageAdapter): void {
    storageAdapter = adapter;
}

export function resetChatSessionStorageAdapter(): void {
    storageAdapter = AsyncStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function toPositiveInteger(value: unknown): number | undefined {
    const parsed = typeof value === 'string' ? Number(value) : value;
    if (typeof parsed !== 'number' || !Number.isFinite(parsed)) return undefined;
    const rounded = Math.floor(parsed);
    return rounded > 0 ? rounded : undefined;
}

function isSessionMode(value: unknown): value is ChatSessionMode {
    return typeof value === 'string' && SESSION_MODES.has(value as ChatSessionMode);
}

/**
 * A finished turn's tool trace is part of what the reader sees — the quiet
 * "Thought it through · Used 2 tools" line above a reply — so it has to survive
 * a resume. Bounded hard, because this is a display artifact and never a
 * transcript: 12 calls per turn, 200 chars per preview.
 */
const MAX_PERSISTED_TOOL_CALLS = 12;
const MAX_TOOL_PREVIEW_CHARS = 200;
const TOOL_STATUSES: AgentToolStatus[] = ['running', 'ok', 'error', 'refused'];
const TOOL_ORIGINS: AgentToolCallOrigin[] = ['structured', 'text'];

function clipPreview(value: unknown): string {
    if (typeof value !== 'string') return '';
    return value.length > MAX_TOOL_PREVIEW_CHARS
        ? `${value.slice(0, MAX_TOOL_PREVIEW_CHARS - 1)}…`
        : value;
}

function sanitizeToolCall(value: unknown): AgentToolCallSnapshot | null {
    if (!isRecord(value)) return null;
    if (typeof value.toolCallId !== 'string' || !value.toolCallId) return null;
    if (typeof value.name !== 'string' || !value.name) return null;
    // A call stored as `running` is stale by definition: no agent loop survives
    // a relaunch, and a stuck spinner would make a finished turn look live.
    const stored = TOOL_STATUSES.includes(value.status as AgentToolStatus)
        ? (value.status as AgentToolStatus)
        : 'ok';
    return {
        toolCallId: value.toolCallId,
        name: value.name,
        label: typeof value.label === 'string' && value.label ? value.label : value.name,
        argsPreview: clipPreview(value.argsPreview),
        status: stored === 'running' ? 'ok' : stored,
        durationMs: toPositiveInteger(value.durationMs),
        resultPreview:
            typeof value.resultPreview === 'string' ? clipPreview(value.resultPreview) : undefined,
        round: toPositiveInteger(value.round) ?? 1,
        origin: TOOL_ORIGINS.includes(value.origin as AgentToolCallOrigin)
            ? (value.origin as AgentToolCallOrigin)
            : undefined,
    };
}

function sanitizeToolActivity(value: unknown): AgentToolCallSnapshot[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const calls = value
        .map(sanitizeToolCall)
        .filter((call): call is AgentToolCallSnapshot => call !== null);
    return calls.length > 0 ? calls.slice(-MAX_PERSISTED_TOOL_CALLS) : undefined;
}

function sanitizeMessage(value: unknown): Message | null {
    if (!isRecord(value)) return null;
    if (typeof value.id !== 'string' || !value.id) return null;
    if (value.role !== 'user' && value.role !== 'assistant') return null;
    if (typeof value.content !== 'string') return null;

    return {
        id: value.id,
        role: value.role,
        content: value.content,
        reasoning: typeof value.reasoning === 'string' ? value.reasoning : undefined,
        toolActivity: sanitizeToolActivity(value.toolActivity),
        ...normalizeTemporalMessageMetadata({
            ...value,
            timestamp: toPositiveInteger(value.timestamp) ?? Date.now(),
        }),
        revision: toPositiveInteger(value.revision),
    };
}

function sanitizeMessages(value: unknown): Message[] {
    if (!Array.isArray(value)) return [];
    return value
        .map(sanitizeMessage)
        .filter((item): item is Message => item !== null);
}

function sanitizeRouteParams(value: unknown): Record<string, string> | undefined {
    if (!isRecord(value)) return undefined;
    const entries = Object.entries(value).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string'
    );
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function sanitizeSession(value: unknown): ChatSession | null {
    if (!isRecord(value)) return null;
    if (typeof value.conversationId !== 'string' || !value.conversationId) return null;
    if (!isSessionMode(value.mode)) return null;

    const updatedAt = toPositiveInteger(value.updatedAt) ?? Date.now();
    const createdAt = toPositiveInteger(value.createdAt) ?? updatedAt;

    return {
        conversationId: value.conversationId,
        mode: value.mode,
        messages: sanitizeMessages(value.messages),
        personaId: typeof value.personaId === 'string' ? value.personaId : undefined,
        routeParams: sanitizeRouteParams(value.routeParams),
        composerDraft: typeof value.composerDraft === 'string' && value.composerDraft.length > 0
            ? value.composerDraft
            : undefined,
        updatedAt,
        createdAt,
    };
}

function sanitizeSessions(value: unknown): ChatSession[] {
    if (!Array.isArray(value)) return [];
    return value
        .map(sanitizeSession)
        .filter((item): item is ChatSession => item !== null);
}

async function writeSessions(sessions: ChatSession[]): Promise<void> {
    try {
        await storageAdapter.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sessions));
    } catch {
        // Swallow: persistence is best-effort and must never crash the chat.
    }
}

export async function loadSessions(): Promise<ChatSession[]> {
    return runAccountBoundOperation('ai-session-storage-read', async () => {
        try {
            const json = await storageAdapter.getItem(CHAT_SESSIONS_KEY);
            if (!json) return [];
            return sanitizeSessions(JSON.parse(json));
        } catch {
            return [];
        }
    });
}

export async function getSession(conversationId: string): Promise<ChatSession | null> {
    if (!conversationId) return null;
    const sessions = await loadSessions();
    return sessions.find((session) => session.conversationId === conversationId) ?? null;
}

export async function saveSession(session: ChatSession): Promise<void> {
    const sanitized = sanitizeSession(session);
    if (!sanitized) return;

    await withSessionMutation(async () => {
        const sessions = await loadSessions();
        const existing = sessions.find(
            (item) => item.conversationId === sanitized.conversationId
        );
        const next: ChatSession = {
            ...sanitized,
            createdAt: existing?.createdAt ?? sanitized.createdAt,
            updatedAt: Date.now(),
        };
        const others = sessions.filter(
            (item) => item.conversationId !== sanitized.conversationId
        );
        await writeSessions(capSessions([next, ...others]));
    });
}

export async function removeSession(conversationId: string): Promise<void> {
    if (!conversationId) return;
    await withSessionMutation(async () => {
        const sessions = await loadSessions();
        const next = sessions.filter((item) => item.conversationId !== conversationId);
        if (next.length === sessions.length) return;
        await writeSessions(next);
    });
}

export async function removeJournalChatSessions(): Promise<void> {
    await withSessionMutation(async () => {
        const sessions = await loadSessions();
        const next = sessions.filter((session) => (
            session.mode !== 'freeform' && session.mode !== 'continue'
        ));
        if (next.length === sessions.length) return;
        await writeSessions(next);
    });
}

export async function removeAllChatSessions(): Promise<void> {
    await withSessionMutation(async () => {
        const sessions = await loadSessions();
        if (sessions.length === 0) return;
        await writeSessions([]);
    });
}

function isActive(session: ChatSession, now: number): boolean {
    return session.messages.length > 0 && now - session.updatedAt <= MAX_AGE_MS;
}

export async function getMostRecentActiveSession(): Promise<ChatSession | null> {
    const now = Date.now();
    const sessions = await loadSessions();
    return sessions
        .filter((session) => isActive(session, now))
        .sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
}

function capSessions(sessions: ChatSession[]): ChatSession[] {
    return [...sessions]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, MAX_SESSIONS);
}

export async function pruneStaleSessions(): Promise<ChatSession[]> {
    return withSessionMutation(async () => {
        const now = Date.now();
        const sessions = await loadSessions();
        const fresh = sessions.filter((session) => now - session.updatedAt <= MAX_AGE_MS);
        const capped = capSessions(fresh);
        if (capped.length !== sessions.length) {
            await writeSessions(capped);
        }
        return capped;
    });
}
