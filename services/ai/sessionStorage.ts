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

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Message } from './chatTypes';

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
        timestamp: toPositiveInteger(value.timestamp) ?? Date.now(),
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
    try {
        const json = await storageAdapter.getItem(CHAT_SESSIONS_KEY);
        if (!json) return [];
        return sanitizeSessions(JSON.parse(json));
    } catch {
        return [];
    }
}

export async function getSession(conversationId: string): Promise<ChatSession | null> {
    if (!conversationId) return null;
    const sessions = await loadSessions();
    return sessions.find((session) => session.conversationId === conversationId) ?? null;
}

export async function saveSession(session: ChatSession): Promise<void> {
    const sanitized = sanitizeSession(session);
    if (!sanitized) return;

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
}

export async function removeSession(conversationId: string): Promise<void> {
    if (!conversationId) return;
    const sessions = await loadSessions();
    const next = sessions.filter((item) => item.conversationId !== conversationId);
    if (next.length === sessions.length) return;
    await writeSessions(next);
}

export async function removeJournalChatSessions(): Promise<void> {
    const sessions = await loadSessions();
    const next = sessions.filter((session) => (
        session.mode !== 'freeform' && session.mode !== 'continue'
    ));
    if (next.length === sessions.length) return;
    await writeSessions(next);
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
    const now = Date.now();
    const sessions = await loadSessions();
    const fresh = sessions.filter((session) => now - session.updatedAt <= MAX_AGE_MS);
    const capped = capSessions(fresh);
    if (capped.length !== sessions.length) {
        await writeSessions(capped);
    }
    return capped;
}
