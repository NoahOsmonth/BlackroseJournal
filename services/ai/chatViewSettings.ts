/**
 * Chat view preferences — how much of the companion's *work* the transcript
 * shows (reasoning + tool timeline) versus only its words.
 *
 * This is deliberately separate from `generationSettings` (which tunes the
 * model) and from `@blackrose_color_theme` (which paints the app): one boolean
 * the reader flips mid-sitting, persisted so it survives a relaunch.
 *
 * Storage rule (AGENTS rule 4): this module owns the key, every write is
 * serialized through the account-bound runtime, and the payload is parsed
 * inside try/catch with a safe default. The shape carries a schema version so
 * a future field can migrate instead of being silently dropped.
 */

import { accountScopedStorage } from '@/services/account/accountScopedStorage';
import { runAccountBoundOperation } from '@/services/account/accountRuntime';

export interface ChatViewSettings {
    /** When false the transcript hides reasoning, tool calls and status lines. */
    showThinking: boolean;
}

interface StorageAdapter {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
}

export const CHAT_VIEW_SETTINGS_KEY = '@blackrose_chat_view_settings';
export const CHAT_VIEW_SETTINGS_SCHEMA_VERSION = 1;

/** Work is visible by default: the toggle hides it, it does not gate it. */
export const DEFAULT_CHAT_VIEW_SETTINGS: ChatViewSettings = {
    showThinking: true,
};

const asyncStorageAdapter: StorageAdapter = accountScopedStorage;

let storageAdapter: StorageAdapter = asyncStorageAdapter;

export function setChatViewSettingsStorageAdapter(adapter: StorageAdapter): void {
    storageAdapter = adapter;
}

export function resetChatViewSettingsStorageAdapter(): void {
    storageAdapter = asyncStorageAdapter;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

/** Tolerates a bare `{ showThinking }` record from before the envelope existed. */
export function sanitizeChatViewSettings(value?: Partial<ChatViewSettings> | null): ChatViewSettings {
    const source = isRecord(value) ? value : {};
    return {
        showThinking: typeof source.showThinking === 'boolean'
            ? source.showThinking
            : DEFAULT_CHAT_VIEW_SETTINGS.showThinking,
    };
}

async function readSettings(): Promise<ChatViewSettings> {
    const json = await storageAdapter.getItem(CHAT_VIEW_SETTINGS_KEY);
    if (!json) return { ...DEFAULT_CHAT_VIEW_SETTINGS };
    try {
        const parsed: unknown = JSON.parse(json);
        return sanitizeChatViewSettings(
            isRecord(parsed) && 'settings' in parsed
                ? (parsed.settings as Partial<ChatViewSettings>)
                : (parsed as Partial<ChatViewSettings>)
        );
    } catch {
        // Corrupt payload: fall back rather than wedging the transcript.
        return { ...DEFAULT_CHAT_VIEW_SETTINGS };
    }
}

export async function loadChatViewSettings(): Promise<ChatViewSettings> {
    return runAccountBoundOperation('chat-view-settings', readSettings);
}

export async function saveChatViewSettings(
    settings: Partial<ChatViewSettings>
): Promise<ChatViewSettings> {
    // One lease for the whole read-modify-write: no nested account operation.
    return runAccountBoundOperation('chat-view-settings', async () => {
        const current = await readSettings();
        const next = sanitizeChatViewSettings({ ...current, ...settings });
        await storageAdapter.setItem(
            CHAT_VIEW_SETTINGS_KEY,
            JSON.stringify({
                schemaVersion: CHAT_VIEW_SETTINGS_SCHEMA_VERSION,
                settings: next,
            })
        );
        return next;
    });
}

export async function resetChatViewSettings(): Promise<ChatViewSettings> {
    return runAccountBoundOperation('chat-view-settings', async () => {
        await storageAdapter.removeItem(CHAT_VIEW_SETTINGS_KEY);
        return { ...DEFAULT_CHAT_VIEW_SETTINGS };
    });
}
