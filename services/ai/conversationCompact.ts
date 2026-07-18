/**
 * Conversation auto-compact for free / small context windows.
 *
 * When the estimated prompt size approaches the model context limit, older
 * turns are collapsed into a rolling summary so the chat keeps working on
 * mobile without 400 "context length exceeded" errors.
 *
 * Extractive by default (no network) so compact always works offline; optional
 * flash LLM polish can be layered later.
 */

import type { Message } from './chatTypes';

/** Rough chars-per-token heuristic used across the app for free-model budgeting. */
export const CHARS_PER_TOKEN = 4;

/** Keep this many most-recent messages verbatim after compact. */
export const COMPACT_KEEP_RECENT = 8;

/**
 * Soft trigger: start compacting when usage exceeds this fraction of the
 * usable context budget (contextWindow - output reserve).
 */
export const COMPACT_TRIGGER_RATIO = 0.62;

/** Harder trigger — compact more aggressively. */
export const COMPACT_HARD_RATIO = 0.78;

/** Default free-model context if unknown. */
export const DEFAULT_COMPACT_CONTEXT_WINDOW = 16_384;

/** Reserve for model completion. */
export const DEFAULT_OUTPUT_RESERVE = 2_048;

/**
 * Target size of the rolling summary in tokens.
 * User asked for ~10–15k of summarized conversation capacity on large windows;
 * we scale down for small free-model windows.
 */
export const SUMMARY_TOKEN_BUDGET_MIN = 800;
export const SUMMARY_TOKEN_BUDGET_MAX = 12_000;

export interface CompactOptions {
    systemPrompt?: string;
    contextWindow?: number;
    outputReserve?: number;
    keepRecent?: number;
    now?: number;
}

export interface CompactResult {
    messages: Message[];
    compacted: boolean;
    estimatedTokensBefore: number;
    estimatedTokensAfter: number;
    summaryTokens: number;
    reason?: string;
}

export function estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function estimateMessagesTokens(messages: readonly Message[]): number {
    return messages.reduce((sum, m) => sum + estimateTokens(m.content) + 4, 0);
}

export function estimatePromptTokens(
    systemPrompt: string,
    messages: readonly Message[]
): number {
    return estimateTokens(systemPrompt) + estimateMessagesTokens(messages) + 16;
}

export function usableContextBudget(
    contextWindow: number,
    outputReserve: number = DEFAULT_OUTPUT_RESERVE
): number {
    const window = Math.max(2_048, Math.floor(contextWindow));
    const reserve = Math.max(256, Math.floor(outputReserve));
    return Math.max(1_024, window - reserve);
}

export function summaryTokenBudget(contextWindow: number): number {
    // Aim for ~15% of window for summary, clamped to [800, 12000]
    const target = Math.floor(contextWindow * 0.15);
    return Math.min(SUMMARY_TOKEN_BUDGET_MAX, Math.max(SUMMARY_TOKEN_BUDGET_MIN, target));
}

export function shouldCompactConversation(
    systemPrompt: string,
    messages: readonly Message[],
    options: CompactOptions = {}
): boolean {
    const contextWindow = options.contextWindow ?? DEFAULT_COMPACT_CONTEXT_WINDOW;
    const budget = usableContextBudget(contextWindow, options.outputReserve);
    const used = estimatePromptTokens(systemPrompt, messages);
    return used >= budget * COMPACT_TRIGGER_RATIO;
}

function formatTurn(message: Message, index: number): string {
    const role = message.role === 'assistant' ? 'Rosebud' : 'User';
    const stamp = message.timestamp
        ? new Date(message.timestamp).toISOString().slice(0, 16).replace('T', ' ')
        : `#${index + 1}`;
    const body = message.content.trim().replace(/\s+/g, ' ');
    return `[${stamp}] ${role}: ${body}`;
}

/**
 * Build an extractive rolling summary of older turns.
 * Prefer user emotional content and named themes; stay under token budget.
 */
export function buildExtractiveConversationSummary(
    older: readonly Message[],
    maxTokens: number = SUMMARY_TOKEN_BUDGET_MIN
): string {
    if (older.length === 0) return '';

    const header = [
        '## Conversation memory (auto-compacted)',
        'Earlier turns in this session were compacted to fit the model context window.',
        'Treat this as faithful session memory. Prefer the live recent turns if anything conflicts.',
        '',
        '### Thread so far',
    ];

    const lines: string[] = [];
    let used = estimateTokens(header.join('\n'));
    const maxChars = maxTokens * CHARS_PER_TOKEN;

    // Walk oldest → newest so the end of the summary is the most recent older context.
    for (let i = 0; i < older.length; i += 1) {
        const line = formatTurn(older[i], i);
        const clipped = line.length > 480 ? `${line.slice(0, 480)}…` : line;
        if (used + estimateTokens(clipped) > maxTokens) {
            // Prefer keeping user turns when space is tight
            if (older[i].role !== 'user') continue;
            const short = clipped.slice(0, Math.max(80, maxChars - used * CHARS_PER_TOKEN));
            if (short.length < 40) break;
            lines.push(short);
            used += estimateTokens(short);
            break;
        }
        lines.push(clipped);
        used += estimateTokens(clipped);
    }

    if (lines.length === 0) {
        return [
            ...header,
            `(${older.length} earlier turns compacted; details unavailable in budget.)`,
        ].join('\n');
    }

    // Light theme extraction from user text
    const userBlob = older
        .filter((m) => m.role === 'user')
        .map((m) => m.content)
        .join(' ')
        .toLowerCase();
    const themeHits = [
        'work', 'sleep', 'anxiety', 'relationship', 'family', 'health',
        'money', 'school', 'friend', 'anger', 'sad', 'happy', 'stress',
        'love', 'fear', 'goal', 'morning', 'night',
    ].filter((t) => userBlob.includes(t));

    const footer = themeHits.length
        ? `\n### Recurring signals\n${themeHits.slice(0, 8).join(', ')}`
        : '';

    return [...header, ...lines, footer].join('\n').trim();
}

/**
 * Compact messages if over budget. Returns original messages when under budget.
 */
export function compactConversationIfNeeded(
    messages: readonly Message[],
    options: CompactOptions = {}
): CompactResult {
    const systemPrompt = options.systemPrompt ?? '';
    const contextWindow = options.contextWindow ?? DEFAULT_COMPACT_CONTEXT_WINDOW;
    const keepRecent = options.keepRecent ?? COMPACT_KEEP_RECENT;
    const before = estimatePromptTokens(systemPrompt, messages);

    if (messages.length <= keepRecent + 2) {
        return {
            messages: [...messages],
            compacted: false,
            estimatedTokensBefore: before,
            estimatedTokensAfter: before,
            summaryTokens: 0,
            reason: 'too-few-messages',
        };
    }

    if (!shouldCompactConversation(systemPrompt, messages, options)) {
        return {
            messages: [...messages],
            compacted: false,
            estimatedTokensBefore: before,
            estimatedTokensAfter: before,
            summaryTokens: 0,
            reason: 'under-budget',
        };
    }

    const budget = usableContextBudget(contextWindow, options.outputReserve);
    const hard = before >= budget * COMPACT_HARD_RATIO;
    const recentCount = hard ? Math.max(4, Math.floor(keepRecent / 2)) : keepRecent;
    const splitAt = Math.max(0, messages.length - recentCount);
    const older = messages.slice(0, splitAt);
    const recent = messages.slice(splitAt);

    const maxSummaryTokens = summaryTokenBudget(contextWindow);
    const summaryText = buildExtractiveConversationSummary(older, maxSummaryTokens);
    const summaryTokens = estimateTokens(summaryText);

    const summaryMessage: Message = {
        id: `compact-summary-${options.now ?? Date.now()}`,
        role: 'user',
        content: `[Session context for Rosebud — not a new user message]\n${summaryText}`,
        timestamp: older[older.length - 1]?.timestamp ?? (options.now ?? Date.now()),
    };

    // Bridge so the model knows the summary is setup, not a rant
    const bridge: Message = {
        id: `compact-bridge-${options.now ?? Date.now()}`,
        role: 'assistant',
        content:
            'I have the compacted memory of our earlier turns in this session and I am with you in the live conversation now. Continuing from where we left off.',
        timestamp: (options.now ?? Date.now()) + 1,
    };

    const next = [summaryMessage, bridge, ...recent];
    const after = estimatePromptTokens(systemPrompt, next);

    // If still over hard budget, drop more of the summary
    if (after >= budget * COMPACT_HARD_RATIO && summaryText.length > 400) {
        const tighter = buildExtractiveConversationSummary(
            older,
            Math.max(SUMMARY_TOKEN_BUDGET_MIN, Math.floor(maxSummaryTokens * 0.45))
        );
        const tightSummary: Message = {
            ...summaryMessage,
            content: `[Session context for Rosebud — not a new user message]\n${tighter}`,
        };
        const tightNext = [tightSummary, bridge, ...recent];
        return {
            messages: tightNext,
            compacted: true,
            estimatedTokensBefore: before,
            estimatedTokensAfter: estimatePromptTokens(systemPrompt, tightNext),
            summaryTokens: estimateTokens(tighter),
            reason: 'hard-compact',
        };
    }

    return {
        messages: next,
        compacted: true,
        estimatedTokensBefore: before,
        estimatedTokensAfter: after,
        summaryTokens,
        reason: hard ? 'hard-compact' : 'soft-compact',
    };
}
