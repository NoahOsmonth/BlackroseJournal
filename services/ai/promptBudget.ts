/**
 * PR8a — prompt-budget ledger + usage logging (instrumentation only).
 *
 * No injection / behavior changes: tags and measures blocks that compose
 * already injects, then logs one [prompt-budget] line per chat call.
 */

import type { Message } from './chatTypes';
import { HISTORY_TOOL_DEFINITIONS, toOpenAiToolSpecs } from './tools';

/** Canonical block labels for the prompt-budget ledger. */
export type PromptBudgetBlockLabel =
    | 'system-companion-static'
    | 'clock-doctrine'
    | 'identity'
    | 'capsule'
    | 'recall-context'
    | 'rollups'
    | 'eager-augmentation'
    | 'tools-schema'
    | 'tools-policy'
    | 'goals'
    | 'persona'
    | 'feedback'
    | 'chat-history'
    | 'user-message';

export type HistoryToolsBranch =
    | 'forced-true'
    | 'forced-false'
    | 'bootstrap'
    | 'historyIntent'
    | 'length>=80'
    | 'PROACTIVE_RE'
    | 'first-turns'
    | 'none';

export interface PromptBudgetBlock {
    label: PromptBudgetBlockLabel;
    chars: number;
    /** Estimated tokens via chars/4 (ceil). */
    estTokens: number;
    /** Raw text length contribution when present in the assembled system/user stream. */
    text?: string;
}

export interface PromptBudgetLedger {
    blocks: PromptBudgetBlock[];
    /** Sum of block chars that are part of the textual system prompt assembly. */
    systemChars: number;
    /** Sum of all ledger block chars (incl. tools-schema JSON, chat-history, user-message). */
    totalChars: number;
    totalEstTokens: number;
    toolsBranch: HistoryToolsBranch;
    realPromptTokens?: number | null;
}

/** chars/4 estimator — intentionally simple and stable for diffs. */
export function estimateTokensFromChars(chars: number): number {
    if (chars <= 0) return 0;
    return Math.ceil(chars / 4);
}

export function estimateTokens(text: string | undefined | null): number {
    if (!text) return 0;
    return estimateTokensFromChars(text.length);
}

function block(
    label: PromptBudgetBlockLabel,
    text: string | undefined | null,
): PromptBudgetBlock | null {
    if (!text) return null;
    const chars = text.length;
    return {
        label,
        chars,
        estTokens: estimateTokensFromChars(chars),
        text,
    };
}

/**
 * Inputs that mirror composeSystemPrompt / streamChat assembly without re-deriving content.
 * Pass the same strings that were actually injected.
 */
export interface PromptBudgetAssemblyInput {
    systemCompanionStatic: string;
    clockDoctrine?: string;
    identity?: string;
    /** Day digests / memory rollups block (## Recent day digests, etc.). */
    rollups?: string;
    /** Capsule (## Local Memory Capsule). */
    capsule?: string;
    /** Turn-level retrieved history + session recall (recall-context). */
    recallContext?: string;
    /** Eager augmentation appended in augmentSystemPromptForTurn (may overlap recall). */
    eagerAugmentation?: string;
    toolsPolicy?: string;
    goals?: string;
    persona?: string;
    feedback?: string;
    messages: readonly Message[];
    /** When true, include OpenAI tools JSON size under tools-schema. */
    includeToolsSchema?: boolean;
    toolsBranch: HistoryToolsBranch;
}

/**
 * Build a ledger for one assembled request. System prompt textual parts use the
 * same order as composeSystemPrompt so sum(system blocks + joiners) can be
 * reconciled against the assembled system string length.
 */
export function buildPromptBudgetLedger(input: PromptBudgetAssemblyInput): PromptBudgetLedger {
    const systemParts: PromptBudgetBlock[] = [
        block('system-companion-static', input.systemCompanionStatic),
        block('clock-doctrine', input.clockDoctrine),
        block('identity', input.identity),
        block('rollups', input.rollups),
        block('recall-context', input.recallContext),
        block('tools-policy', input.toolsPolicy),
        block('capsule', input.capsule),
        block('goals', input.goals),
        block('persona', input.persona),
        block('feedback', input.feedback),
        block('eager-augmentation', input.eagerAugmentation),
    ].filter((b): b is PromptBudgetBlock => Boolean(b));

    // Joiners: composeSystemPrompt uses '\n\n' between non-empty parts.
    const joinerChars = systemParts.length > 1 ? (systemParts.length - 1) * 2 : 0;
    const systemChars = systemParts.reduce((sum, b) => sum + b.chars, 0) + joinerChars;

    const historyText = input.messages
        .filter((m) => m.role === 'assistant' || (m.role === 'user' && m !== input.messages[input.messages.length - 1]))
        .map((m) => m.content)
        .join('\n');
    // Full chat history (all turns) for size; user-message is the latest user turn.
    const fullHistory = input.messages.map((m) => m.content).join('\n');
    const latestUser = [...input.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const priorHistory = input.messages
        .filter((m) => !(m.role === 'user' && m.content === latestUser && m === input.messages[input.messages.length - 1]))
        .map((m) => m.content)
        .join('\n');

    const extra: PromptBudgetBlock[] = [];

    if (input.includeToolsSchema) {
        const schemaJson = JSON.stringify(toOpenAiToolSpecs(HISTORY_TOOL_DEFINITIONS));
        extra.push({
            label: 'tools-schema',
            chars: schemaJson.length,
            estTokens: estimateTokensFromChars(schemaJson.length),
            text: schemaJson,
        });
    }

    if (priorHistory.length > 0) {
        extra.push({
            label: 'chat-history',
            chars: priorHistory.length,
            estTokens: estimateTokensFromChars(priorHistory.length),
            text: priorHistory,
        });
    } else if (fullHistory.length > 0 && !latestUser) {
        extra.push({
            label: 'chat-history',
            chars: fullHistory.length,
            estTokens: estimateTokensFromChars(fullHistory.length),
            text: fullHistory,
        });
    }

    // Prefer explicit prior turns; if only one user message, history is empty and user-message carries it.
    void historyText;

    if (latestUser) {
        extra.push({
            label: 'user-message',
            chars: latestUser.length,
            estTokens: estimateTokensFromChars(latestUser.length),
            text: latestUser,
        });
    }

    const blocks = [...systemParts, ...extra];
    const totalChars = blocks.reduce((sum, b) => sum + b.chars, 0);
    const totalEstTokens = blocks.reduce((sum, b) => sum + b.estTokens, 0);

    return {
        blocks,
        systemChars,
        totalChars,
        totalEstTokens,
        toolsBranch: input.toolsBranch,
        realPromptTokens: null,
    };
}

/** Sum of ledger block texts that form the system prompt (excluding tools-schema / chat / user). */
export const SYSTEM_LEDGER_LABELS: ReadonlySet<PromptBudgetBlockLabel> = new Set([
    'system-companion-static',
    'clock-doctrine',
    'identity',
    'rollups',
    'recall-context',
    'tools-policy',
    'capsule',
    'goals',
    'persona',
    'feedback',
    'eager-augmentation',
]);

/**
 * Reconstruct assembled system prompt from ledger system blocks (same join as compose).
 * Used by tests: ledger sum must match assembled length.
 */
export function assembleSystemPromptFromLedger(ledger: PromptBudgetLedger): string {
    return ledger.blocks
        .filter((b) => SYSTEM_LEDGER_LABELS.has(b.label) && b.text)
        .map((b) => b.text as string)
        .join('\n\n');
}

export function attachRealUsage(
    ledger: PromptBudgetLedger,
    usage: { prompt_tokens?: number } | null | undefined,
): PromptBudgetLedger {
    const real = usage && typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : null;
    return { ...ledger, realPromptTokens: real };
}

/**
 * One-line console log — stable prefix for live grep.
 * PR8c: never bare `n/a` — use `usage-unavailable` when the provider omits usage.
 */
export function formatPromptBudgetLogLine(ledger: PromptBudgetLedger): string {
    const perBlock = ledger.blocks
        .map((b) => `${b.label}=${b.estTokens}`)
        .join(' ');
    const real =
        ledger.realPromptTokens == null
            ? 'usage-unavailable'
            : String(ledger.realPromptTokens);
    return (
        `[prompt-budget] branch=${ledger.toolsBranch} ` +
        `estTotal=${ledger.totalEstTokens} systemChars=${ledger.systemChars} ` +
        `${perBlock} real.prompt_tokens=${real}`
    );
}

export function logPromptBudget(ledger: PromptBudgetLedger): void {
    // eslint-disable-next-line no-console
    console.log(formatPromptBudgetLogLine(ledger));
}

/** Extract OpenAI-style usage object from a chat.completions JSON body. */
export function extractUsageFromCompletion(data: unknown): { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null {
    if (!data || typeof data !== 'object') return null;
    const usage = (data as { usage?: unknown }).usage;
    if (!usage || typeof usage !== 'object') return null;
    const u = usage as Record<string, unknown>;
    const out: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } = {};
    if (typeof u.prompt_tokens === 'number') out.prompt_tokens = u.prompt_tokens;
    if (typeof u.completion_tokens === 'number') out.completion_tokens = u.completion_tokens;
    if (typeof u.total_tokens === 'number') out.total_tokens = u.total_tokens;
    return out;
}

/**
 * Split an already-assembled system prompt into labeled blocks by known headers.
 * Companion static is everything before the first recognized section header.
 * Eager augmentation headers (Retrieved history / Relevant past) map to recall-context
 * when not already counted; callers may also pass a separate eager delta.
 */
const SECTION_RULES: { match: RegExp; label: PromptBudgetBlockLabel }[] = [
    { match: /^## Clock\b/m, label: 'clock-doctrine' },
    // Identity profile block only (## Identity) — not companion headers.
    { match: /^## Identity\b/m, label: 'identity' },
    { match: /^## Recent day digests\b/m, label: 'rollups' },
    { match: /^## Retrieved history\b/m, label: 'recall-context' },
    { match: /^## Relevant past\b/m, label: 'recall-context' },
    { match: /^## On-device tools\b/m, label: 'tools-policy' },
    { match: /^## Local Memory Capsule\b/m, label: 'capsule' },
    { match: /^## User's Current Goals\b/m, label: 'goals' },
    { match: /^## Persona Guidance\b/m, label: 'persona' },
];

interface Slice {
    start: number;
    label: PromptBudgetBlockLabel;
}

function findSectionSlices(systemPrompt: string): Slice[] {
    const slices: Slice[] = [];
    for (const rule of SECTION_RULES) {
        const m = rule.match.exec(systemPrompt);
        if (m && typeof m.index === 'number') {
            slices.push({ start: m.index, label: rule.label });
        }
    }
    slices.sort((a, b) => a.start - b.start);
    // Deduplicate same start; keep first label
    const out: Slice[] = [];
    for (const s of slices) {
        if (out.length && out[out.length - 1].start === s.start) continue;
        out.push(s);
    }
    return out;
}

/**
 * Build ledger from the final system string + messages (streamChat path).
 * Does not re-inject — only measures what was assembled.
 */
export function buildLedgerFromAssembledRequest(options: {
    systemPrompt: string;
    messages: readonly Message[];
    toolsBranch: HistoryToolsBranch;
    includeToolsSchema?: boolean;
    /** Chars appended by augmentSystemPromptForTurn (tagged eager-augmentation). */
    eagerAugmentationText?: string;
}): PromptBudgetLedger {
    const { systemPrompt, messages, toolsBranch } = options;
    const slices = findSectionSlices(systemPrompt);
    const systemBlocks: PromptBudgetBlock[] = [];

    const firstSection = slices.length > 0 ? slices[0].start : systemPrompt.length;
    const staticText = systemPrompt.slice(0, firstSection).replace(/\n+$/, '');
    if (staticText.trim()) {
        systemBlocks.push({
            label: 'system-companion-static',
            chars: staticText.length,
            estTokens: estimateTokensFromChars(staticText.length),
            text: staticText,
        });
    }

    for (let i = 0; i < slices.length; i += 1) {
        const start = slices[i].start;
        const end = i + 1 < slices.length ? slices[i + 1].start : systemPrompt.length;
        let text = systemPrompt.slice(start, end);
        // strip trailing joiners that belong between sections
        text = text.replace(/\n+$/, '');
        // skip zero-length
        if (!text) continue;
        // If this slice is the eager delta already tagged separately, still count under its header label.
        systemBlocks.push({
            label: slices[i].label,
            chars: text.length,
            estTokens: estimateTokensFromChars(text.length),
            text,
        });
    }

    // Eager augmentation: if caller provides the exact appended text and it is
    // present at the end, also emit an eager-augmentation row (duplicate measure
    // of the same tokens is intentional for the "eager" column — use for delta only).
    // We do NOT double-count in totalChars: only add eager row when it is NOT
    // already covered by a recall-context slice matching that text.
    if (options.eagerAugmentationText && options.eagerAugmentationText.trim()) {
        const eager = options.eagerAugmentationText.trim();
        const already = systemBlocks.some(
            (b) => b.label === 'recall-context' && b.text && b.text.includes(eager.slice(0, 40)),
        );
        if (!already) {
            systemBlocks.push({
                label: 'eager-augmentation',
                chars: eager.length,
                estTokens: estimateTokensFromChars(eager.length),
                text: eager,
            });
        } else {
            // Mark the recall slice also as having been eager-sourced via a zero-char tag row? Skip.
            // Instead re-label is wrong. Leave recall-context; log eager=0 by omission.
        }
    }

    const latestUser = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const lastUserIndex = (() => {
        for (let i = messages.length - 1; i >= 0; i -= 1) {
            if (messages[i].role === 'user') return i;
        }
        return -1;
    })();
    const prior = messages
        .filter((_, i) => i !== lastUserIndex)
        .map((m) => m.content)
        .join('\n');

    const extra: PromptBudgetBlock[] = [];
    if (options.includeToolsSchema) {
        const schemaJson = JSON.stringify(toOpenAiToolSpecs(HISTORY_TOOL_DEFINITIONS));
        extra.push({
            label: 'tools-schema',
            chars: schemaJson.length,
            estTokens: estimateTokensFromChars(schemaJson.length),
            text: schemaJson,
        });
    }
    if (prior.length > 0) {
        extra.push({
            label: 'chat-history',
            chars: prior.length,
            estTokens: estimateTokensFromChars(prior.length),
            text: prior,
        });
    }
    if (latestUser) {
        extra.push({
            label: 'user-message',
            chars: latestUser.length,
            estTokens: estimateTokensFromChars(latestUser.length),
            text: latestUser,
        });
    }

    const blocks = [...systemBlocks, ...extra];
    // systemChars: actual assembled system prompt length (source of truth)
    const systemChars = systemPrompt.length;
    const totalChars = blocks.reduce((sum, b) => sum + b.chars, 0);
    const totalEstTokens = blocks.reduce((sum, b) => sum + b.estTokens, 0);

    return {
        blocks,
        systemChars,
        totalChars,
        totalEstTokens,
        toolsBranch,
        realPromptTokens: null,
    };
}

/**
 * Sum of system-section block chars + inter-section joiners should equal systemPrompt.length
 * when the prompt was produced solely from those sections. Used by Jest ledger equality.
 */
export function sumSystemBlockChars(ledger: PromptBudgetLedger): number {
    return ledger.blocks
        .filter((b) => SYSTEM_LEDGER_LABELS.has(b.label))
        .reduce((sum, b) => sum + b.chars, 0);
}
