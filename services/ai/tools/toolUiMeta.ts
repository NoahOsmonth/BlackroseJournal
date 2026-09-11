/**
 * Human-readable UI metadata for on-device tools.
 * Single source of truth for the visible tool-calling timeline copy.
 */

import { HISTORY_TOOL_DEFINITIONS } from './definitions';
import type { ToolResult } from './types';

export const MAX_ARGS_PREVIEW_CHARS = 120;
export const MAX_RESULT_PREVIEW_CHARS = 100;

export interface ToolUiMeta {
    /** Human label shown on the activity row (not the raw tool name). */
    label: string;
    /** Material icon name for the row. */
    iconName: string;
    /** Compact args chip; falls back to a generic preview when omitted. */
    formatArgsPreview?: (args: Record<string, unknown>) => string;
    /** 1-line result teaser; defaults to first non-empty line of the result. */
    formatResultPreview?: (result: ToolResult) => string;
}

function firstPreviewArg(args: Record<string, unknown>, keys: readonly string[]): string {
    for (const key of keys) {
        const value = args[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
        if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
    return '';
}

function truncatePreview(text: string, max: number): string {
    const trimmed = text.trim().replace(/\s+/g, ' ');
    if (trimmed.length <= max) return trimmed;
    return `${trimmed.slice(0, max - 1)}…`;
}

function stringifyArgsPreview(args: Record<string, unknown>): string {
    try {
        return truncatePreview(JSON.stringify(args), MAX_ARGS_PREVIEW_CHARS);
    } catch {
        return '{}';
    }
}

export function defaultResultPreview(result: ToolResult): string {
    const lines = result.content
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    const head = lines[0] ?? '';
    return truncatePreview(head, MAX_RESULT_PREVIEW_CHARS);
}

const DEFAULT_META: ToolUiMeta = {
    label: 'Using a tool',
    iconName: 'build',
};

export const TOOL_UI_META: Record<string, ToolUiMeta> = {
    get_clock: {
        label: 'Checking the time',
        iconName: 'schedule',
        formatArgsPreview: () => '—',
    },
    list_recent_days: {
        label: 'Scanning recent days',
        iconName: 'today',
        formatArgsPreview: (args) => {
            if (typeof args.days === 'number') return `${args.days} days`;
            if (typeof args.from === 'string' || typeof args.to === 'string') {
                const from = typeof args.from === 'string' ? args.from : '…';
                const to = typeof args.to === 'string' ? args.to : '…';
                return `${from} → ${to}`;
            }
            return 'recent days';
        },
    },
    get_day: {
        label: 'Reading a day',
        iconName: 'calendar-today',
        formatArgsPreview: (args) => firstPreviewArg(args, ['date', 'day']) || 'day',
    },
    get_conversation: {
        label: 'Opening a past entry',
        iconName: 'description',
        formatArgsPreview: (args) => {
            const kind = firstPreviewArg(args, ['kind']) || 'entry';
            const id = firstPreviewArg(args, ['id']);
            if (!id) return kind;
            const short = id.length > 12 ? `${id.slice(0, 8)}…` : id;
            return `${kind} · ${short}`;
        },
        // Never surface transcript prose — title/length only.
        formatResultPreview: (result) => {
            const lines = result.content.split('\n').map((l) => l.trim()).filter(Boolean);
            const titleLine = lines.find((l) => /^title:/i.test(l));
            if (titleLine) return truncatePreview(titleLine, MAX_RESULT_PREVIEW_CHARS);
            return truncatePreview(`${lines.length} lines loaded`, MAX_RESULT_PREVIEW_CHARS);
        },
    },
    search_history: {
        label: 'Searching your history',
        iconName: 'search',
        formatArgsPreview: (args) => firstPreviewArg(args, ['query', 'q']) || 'search',
    },
    recall_memory: {
        label: 'Searching long-term memory',
        iconName: 'psychology',
        formatArgsPreview: (args) => {
            const query = firstPreviewArg(args, ['query']);
            if (!query) return 'memory';
            return truncatePreview(query, 40);
        },
    },
    get_identity: {
        label: 'Reading your profile',
        iconName: 'person',
        formatArgsPreview: () => '—',
    },
    update_identity: {
        label: 'Saving profile facts',
        iconName: 'badge',
        formatArgsPreview: (args) => {
            const name = firstPreviewArg(args, ['preferredName', 'name']);
            if (name) return `name: ${name}`;
            return stringifyArgsPreview(args);
        },
    },
    list_goals: {
        label: 'Listing goals',
        iconName: 'checklist',
        formatArgsPreview: () => '—',
    },
    create_goal: {
        label: 'Creating a goal',
        iconName: 'add-task',
        formatArgsPreview: (args) => firstPreviewArg(args, ['title']) || 'new goal',
    },
};

export function getToolUiMeta(name: string): ToolUiMeta {
    return TOOL_UI_META[name] ?? DEFAULT_META;
}

export function formatToolArgsPreview(name: string, rawArgs: string): string {
    const meta = getToolUiMeta(name);
    let parsed: Record<string, unknown> = {};
    try {
        const value: unknown = rawArgs && rawArgs.trim() ? JSON.parse(rawArgs) : {};
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            parsed = value as Record<string, unknown>;
        }
    } catch {
        parsed = {};
    }
    const preview = meta.formatArgsPreview
        ? meta.formatArgsPreview(parsed)
        : stringifyArgsPreview(parsed);
    return truncatePreview(preview, MAX_ARGS_PREVIEW_CHARS);
}

export function formatToolResultPreview(name: string, result: ToolResult): string {
    const meta = getToolUiMeta(name);
    if (meta.formatResultPreview) {
        return truncatePreview(meta.formatResultPreview(result), MAX_RESULT_PREVIEW_CHARS);
    }
    return defaultResultPreview(result);
}

/** Every registry tool name must have UI meta (guard for new tools). */
export function listToolsMissingUiMeta(): string[] {
    return HISTORY_TOOL_DEFINITIONS
        .map((def) => def.name)
        .filter((name) => !TOOL_UI_META[name]);
}
