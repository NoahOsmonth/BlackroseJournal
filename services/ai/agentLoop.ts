/**
 * Client-side agent loop with local history tools.
 * Runs non-streaming completion rounds; callers stream the final text to the UI.
 *
 * Pipeline (2026-style):
 *   1. structured tool_calls from the provider
 *   2. local schema validate + repair + dedupe
 *   3. text pseudo-code parse (degraded free-model path)
 *   4. execute on device, feed results, loop
 *
 * PR8c hardening:
 *   - AGENT_TURN_TOKEN_BUDGET cumulative across rounds
 *   - repeated identical tool-call → note + final no-tools pass
 *   - max-round exhaustion never ships loop narration
 */

import {
    DEFAULT_GENERATION,
    type GenerationSettings,
    sanitizeGenerationSettings,
} from './generationSettings';
import { fetchDirectChatCompletion } from './directTransport';
import { HISTORY_TOOL_DEFINITIONS, executeToolCalls, toOpenAiToolSpecs } from './tools';
import {
    formatToolResultsForModel,
    parseTextToolCalls,
    stripToolCallSyntax,
} from './tools/parseTextToolCalls';
import {
    logToolTelemetry,
    markToolsUnsupported,
    resolveToolCapability,
    type ToolCapability,
} from './tools/toolCapability';
import {
    prepareToolCalls,
    toolCallDedupeKey,
    type ToolCallOrigin,
} from './tools/validateToolCalls';
import type { AgentMessage, ToolCall } from './tools/types';
import type { Message } from './chatTypes';
import { estimateTokensFromChars, extractUsageFromCompletion } from './promptBudget';

export const MAX_AGENT_TOOL_ROUNDS = 3;
/**
 * Hard cap for non-streaming tool rounds. Settings often allow 32k max_tokens;
 * free reasoning models will spend that budget on chain-of-thought and the UI
 * sits on a typing indicator until the entire round finishes.
 */
export const AGENT_ROUND_MAX_TOKENS = 1_536;

/**
 * PR8c: cumulative prompt-token budget across all tool rounds of one agent turn.
 * Real usage.prompt_tokens when available; chars/4 estimator otherwise.
 * Tools-schema + framing often add ~900 real tokens/round outside the system string.
 */
export const AGENT_TURN_TOKEN_BUDGET = 12_000;

/**
 * User-visible fallback when tool rounds exhaust and the final no-tools pass
 * fails or returns empty. Must never be loop narration.
 */
export const AGENT_EXHAUSTION_FALLBACK =
    'I looked through what is on this device, but I am having trouble putting the answer into words. Try asking once more, or rephrase slightly.';

/**
 * Injected when the model repeats an identical tool name + args already executed
 * this turn. Triggers the final no-tools pass.
 */
export const DUPLICATE_TOOL_CALL_NOTE =
    'System note: duplicate call — you already have these results; answer with what you have.';

export class ToolsUnsupportedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ToolsUnsupportedError';
    }
}

export type AgentToolCallSource = 'structured' | 'text' | 'mixed' | 'none';

export type AgentTokenSource = 'real' | 'est';

export interface AgentLoopResult {
    content: string;
    reasoning: string;
    usedTools: boolean;
    rounds: number;
    /** How tool calls were obtained for this turn. */
    toolCallSource: AgentToolCallSource;
    toolsRepaired: number;
    toolsSkippedInvalid: number;
    toolsSkippedDuplicate: number;
    capabilityMode: ToolCapability['mode'];
    /** Provider usage from the last completion round (when present). */
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
    /** Cumulative prompt tokens billed to the turn budget (real or est). */
    cumulativePromptTokens?: number;
    /** Why the loop stopped early, if applicable. */
    stopReason?: 'complete' | 'max_rounds' | 'token_budget' | 'duplicate_call' | 'skipped';
}

interface AgentLoopOptions {
    systemPrompt: string;
    messages: Message[];
    generation?: Partial<GenerationSettings>;
    maxRounds?: number;
    model?: string;
    /** Override capability (tests / advanced). */
    capability?: ToolCapability;
    /** Override turn token budget (tests). Defaults to AGENT_TURN_TOKEN_BUDGET. */
    turnTokenBudget?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function argsToString(value: unknown): string {
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value ?? {});
    } catch {
        return '{}';
    }
}

/**
 * Extract structured tool calls from a chat.completions payload.
 * Handles OpenAI `tool_calls`, legacy `function_call`, and loose provider shapes.
 */
function extractToolCalls(data: unknown): ToolCall[] {
    if (!isRecord(data)) return [];
    const choices = data.choices;
    if (!Array.isArray(choices) || choices.length === 0) return [];
    const choice = choices[0];
    if (!isRecord(choice)) return [];
    const message = choice.message;
    if (!isRecord(message)) return [];

    const out: ToolCall[] = [];

    const toolCalls = message.tool_calls;
    if (Array.isArray(toolCalls)) {
        toolCalls.forEach((raw, index) => {
            if (!isRecord(raw)) return;
            const fn = isRecord(raw.function) ? raw.function : null;
            const name =
                (fn && typeof fn.name === 'string' && fn.name)
                || (typeof raw.name === 'string' && raw.name)
                || '';
            if (!name) return;
            const id = typeof raw.id === 'string' && raw.id ? raw.id : `call_${index}`;
            const argsRaw = fn
                ? (fn.arguments ?? fn.parameters)
                : (raw.arguments ?? raw.parameters);
            out.push({ id, name, arguments: argsToString(argsRaw) });
        });
    }

    if (out.length === 0 && isRecord(message.function_call)) {
        const fc = message.function_call;
        const name = typeof fc.name === 'string' ? fc.name : '';
        if (name) {
            out.push({
                id: 'call_legacy_0',
                name,
                arguments: argsToString(fc.arguments),
            });
        }
    }

    return out;
}

function extractAssistantContent(data: unknown): { content: string; reasoning: string } {
    if (!isRecord(data)) return { content: '', reasoning: '' };
    const choices = data.choices;
    if (!Array.isArray(choices) || !isRecord(choices[0])) return { content: '', reasoning: '' };
    const message = choices[0].message;
    if (!isRecord(message)) return { content: '', reasoning: '' };
    return {
        content: typeof message.content === 'string' ? message.content : '',
        reasoning:
            (typeof message.reasoning === 'string' && message.reasoning)
            || (typeof message.reasoning_content === 'string' && message.reasoning_content)
            || '',
    };
}

function buildAgentMessages(systemPrompt: string, messages: Message[]): AgentMessage[] {
    return [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
        })),
    ];
}

function looksLikeToolsError(status: number, body: string): boolean {
    if (status === 400 || status === 404 || status === 422) {
        const lower = body.toLowerCase();
        return (
            lower.includes('tool')
            || lower.includes('function')
            || lower.includes('unknown field')
            || lower.includes('unrecognized')
            || lower.includes('not supported')
        );
    }
    return false;
}

function finalizeUserFacingContent(content: string, reasoning: string): string {
    const stripped = stripToolCallSyntax(content);
    if (stripped.trim()) return stripped;
    const strippedReasoning = stripToolCallSyntax(reasoning);
    return strippedReasoning.trim() ? strippedReasoning : '';
}

function emptyResult(
    capabilityMode: ToolCapability['mode'],
    extra?: Partial<AgentLoopResult>
): AgentLoopResult {
    return {
        content: '',
        reasoning: '',
        usedTools: false,
        rounds: 0,
        toolCallSource: 'none',
        toolsRepaired: 0,
        toolsSkippedInvalid: 0,
        toolsSkippedDuplicate: 0,
        capabilityMode,
        stopReason: 'skipped',
        ...extra,
    };
}

function mergeToolSource(
    current: AgentToolCallSource,
    origins: readonly ToolCallOrigin[]
): AgentToolCallSource {
    const hasS = origins.includes('structured') || current === 'structured' || current === 'mixed';
    const hasT = origins.includes('text') || current === 'text' || current === 'mixed';
    if (hasS && hasT) return 'mixed';
    if (hasS) return 'structured';
    if (hasT) return 'text';
    return current;
}

function agentRoundMaxTokens(settings: GenerationSettings): number {
    return Math.min(settings.maxTokens, AGENT_ROUND_MAX_TOKENS);
}

/** Estimate prompt tokens for a round when the provider omits usage (chars/4). */
export function estimateAgentRoundPromptTokens(
    agentMessages: readonly AgentMessage[],
    sendTools: boolean
): number {
    let chars = 0;
    try {
        chars += JSON.stringify(agentMessages).length;
    } catch {
        chars += agentMessages.reduce((sum, m) => sum + (m.content?.length ?? 0), 0);
    }
    if (sendTools) {
        try {
            chars += JSON.stringify(toOpenAiToolSpecs(HISTORY_TOOL_DEFINITIONS)).length;
        } catch {
            chars += 3_600; // ~tools-schema framing ballpark
        }
    }
    return estimateTokensFromChars(chars);
}

function accountRoundTokens(
    data: unknown,
    agentMessages: readonly AgentMessage[],
    sendTools: boolean
): { tokens: number; source: AgentTokenSource } {
    const usage = extractUsageFromCompletion(data);
    if (usage && typeof usage.prompt_tokens === 'number' && Number.isFinite(usage.prompt_tokens)) {
        return { tokens: usage.prompt_tokens, source: 'real' };
    }
    return {
        tokens: estimateAgentRoundPromptTokens(agentMessages, sendTools),
        source: 'est',
    };
}

function logRoundTokenBudget(options: {
    round: number;
    tokens: number;
    source: AgentTokenSource;
    cumulative: number;
    budget: number;
}): void {
    // eslint-disable-next-line no-console
    console.log(
        `[agent-loop] round=${options.round} tokens=${options.tokens} source=${options.source} `
        + `cumulative=${options.cumulative} budget=${options.budget}`
    );
}

async function completeWithTools(
    agentMessages: AgentMessage[],
    settings: GenerationSettings,
    model: string,
    sendTools: boolean
): Promise<unknown> {
    const response = await fetchDirectChatCompletion({
        model,
        messages: agentMessages as unknown as { role: string; content: string }[],
        stream: false,
        temperature: settings.temperature,
        top_p: settings.topP,
        max_tokens: agentRoundMaxTokens(settings),
        ...(sendTools
            ? {
                tools: toOpenAiToolSpecs(HISTORY_TOOL_DEFINITIONS),
                tool_choice: 'auto' as const,
            }
            : {}),
    });

    const rawText = await response.text();
    if (!response.ok) {
        if (sendTools && looksLikeToolsError(response.status, rawText)) {
            markToolsUnsupported(model);
            throw new ToolsUnsupportedError(
                `Provider rejected tools (${response.status}). ${rawText.slice(0, 200)}`
            );
        }
        throw new Error(`Agent completion failed (${response.status}). ${rawText.slice(0, 200)}`);
    }

    try {
        return JSON.parse(rawText) as unknown;
    } catch {
        throw new Error(`Agent completion returned non-JSON. Preview: ${rawText.slice(0, 200)}`);
    }
}

async function completeWithoutTools(
    agentMessages: AgentMessage[],
    settings: GenerationSettings,
    model: string
): Promise<{ content: string; reasoning: string; usage: AgentLoopResult['usage'] }> {
    const response = await fetchDirectChatCompletion({
        model,
        messages: agentMessages as unknown as { role: string; content: string }[],
        stream: false,
        temperature: settings.temperature,
        top_p: settings.topP,
        max_tokens: agentRoundMaxTokens(settings),
    });
    const rawText = await response.text();
    if (!response.ok) {
        throw new Error(`Agent final pass failed (${response.status}). ${rawText.slice(0, 200)}`);
    }
    let data: unknown;
    try {
        data = JSON.parse(rawText);
    } catch {
        throw new Error(`Agent final pass non-JSON. Preview: ${rawText.slice(0, 200)}`);
    }
    const extracted = extractAssistantContent(data);
    return {
        ...extracted,
        usage: extractUsageFromCompletion(data),
    };
}

const TEXT_TOOL_NUDGE =
    'Your previous message was tool-call code/syntax, not a user-facing reply. '
    + 'Answer the user in natural language only. Use any tool results and context already provided. '
    + 'Do not write function calls, XML, JSON tool objects, or code fences.';

function baseResultFields(options: {
    usedTools: boolean;
    rounds: number;
    toolCallSource: AgentToolCallSource;
    toolsRepaired: number;
    toolsSkippedInvalid: number;
    toolsSkippedDuplicate: number;
    capabilityMode: ToolCapability['mode'];
    usage: AgentLoopResult['usage'];
    cumulativePromptTokens: number;
    stopReason: NonNullable<AgentLoopResult['stopReason']>;
}): Omit<AgentLoopResult, 'content' | 'reasoning'> {
    return {
        usedTools: options.usedTools,
        rounds: options.rounds,
        toolCallSource: options.toolCallSource,
        toolsRepaired: options.toolsRepaired,
        toolsSkippedInvalid: options.toolsSkippedInvalid,
        toolsSkippedDuplicate: options.toolsSkippedDuplicate,
        capabilityMode: options.capabilityMode,
        usage: options.usage,
        cumulativePromptTokens: options.cumulativePromptTokens,
        stopReason: options.stopReason,
    };
}

/**
 * Final no-tools pass after tool rounds stop (budget / duplicate / max rounds).
 * Never returns loop narration: empty/failed → AGENT_EXHAUSTION_FALLBACK.
 */
async function runFinalNoToolsPass(
    agentMessages: AgentMessage[],
    settings: GenerationSettings,
    model: string,
    meta: {
        usedTools: boolean;
        rounds: number;
        toolCallSource: AgentToolCallSource;
        toolsRepaired: number;
        toolsSkippedInvalid: number;
        toolsSkippedDuplicate: number;
        capabilityMode: ToolCapability['mode'];
        lastUsage: AgentLoopResult['usage'];
        cumulativePromptTokens: number;
        stopReason: NonNullable<AgentLoopResult['stopReason']>;
    }
): Promise<AgentLoopResult> {
    try {
        const final = await completeWithoutTools(agentMessages, settings, model);
        const safe = finalizeUserFacingContent(final.content, final.reasoning);
        if (!safe.trim()) {
            return {
                content: AGENT_EXHAUSTION_FALLBACK,
                reasoning: final.reasoning,
                ...baseResultFields({
                    ...meta,
                    usage: final.usage ?? meta.lastUsage,
                }),
            };
        }
        return {
            content: safe,
            reasoning: final.reasoning,
            ...baseResultFields({
                ...meta,
                usage: final.usage ?? meta.lastUsage,
            }),
        };
    } catch (error) {
        console.warn('Agent final no-tools pass failed:', error);
        return {
            content: AGENT_EXHAUSTION_FALLBACK,
            reasoning: '',
            ...baseResultFields({
                ...meta,
                usage: meta.lastUsage,
            }),
        };
    }
}

export async function runAgentTurnWithTools(options: AgentLoopOptions): Promise<AgentLoopResult> {
    const settings = sanitizeGenerationSettings(options.generation ?? DEFAULT_GENERATION);
    const maxRounds = options.maxRounds ?? MAX_AGENT_TOOL_ROUNDS;
    const model = options.model ?? 'agent-default';
    const capability = options.capability ?? resolveToolCapability(model);
    const turnBudget = options.turnTokenBudget ?? AGENT_TURN_TOKEN_BUDGET;

    if (!capability.runAgentLoop) {
        logToolTelemetry('agent_skipped_inject_only', { model, mode: capability.mode });
        return emptyResult(capability.mode);
    }

    const agentMessages = buildAgentMessages(options.systemPrompt, options.messages);
    const executedKeys = new Set<string>();

    let usedTools = false;
    let rounds = 0;
    let toolCallSource: AgentToolCallSource = 'none';
    let toolsRepaired = 0;
    let toolsSkippedInvalid = 0;
    let toolsSkippedDuplicate = 0;
    let sendTools = capability.sendToolsInApi;
    let lastUsage: AgentLoopResult['usage'] = null;
    let cumulativePromptTokens = 0;
    let stopReason: NonNullable<AgentLoopResult['stopReason']> = 'complete';

    for (let round = 0; round < maxRounds; round += 1) {
        // Cross-round budget: do not start another model+tools round if already over.
        if (round > 0 && cumulativePromptTokens >= turnBudget) {
            stopReason = 'token_budget';
            logToolTelemetry('agent_token_budget', {
                model,
                cumulative: cumulativePromptTokens,
                budget: turnBudget,
            });
            break;
        }

        rounds = round + 1;
        let data: unknown;
        try {
            data = await completeWithTools(agentMessages, settings, model, sendTools);
        } catch (error) {
            if (error instanceof ToolsUnsupportedError && sendTools) {
                // Provider rejected tools mid-session — fall back to text-only completion once.
                sendTools = false;
                markToolsUnsupported(model);
                data = await completeWithTools(agentMessages, settings, model, false);
            } else {
                throw error;
            }
        }

        lastUsage = extractUsageFromCompletion(data) ?? lastUsage;

        const accounted = accountRoundTokens(data, agentMessages, sendTools);
        cumulativePromptTokens += accounted.tokens;
        logRoundTokenBudget({
            round: rounds,
            tokens: accounted.tokens,
            source: accounted.source,
            cumulative: cumulativePromptTokens,
            budget: turnBudget,
        });

        const structuredCalls = extractToolCalls(data);
        const { content, reasoning } = extractAssistantContent(data);

        const textParsed = capability.parseTextToolDumps
            ? parseTextToolCalls(content, `text_r${round}`)
            : { toolCalls: [] as ToolCall[], cleanedContent: content, lookedLikeToolDump: false };

        const candidateCount = structuredCalls.length + textParsed.toolCalls.length;

        // Prefer structured; if missing or all invalid after repair, fall back to text dumps.
        let prepared = prepareToolCalls(
            structuredCalls.map((call) => ({ call, origin: 'structured' as const })),
            executedKeys
        );
        if (prepared.calls.length === 0 && capability.parseTextToolDumps) {
            const fromText = prepareToolCalls(
                textParsed.toolCalls.map((call) => ({ call, origin: 'text' as const })),
                executedKeys
            );
            prepared = {
                calls: fromText.calls,
                repairedCount: prepared.repairedCount + fromText.repairedCount,
                skippedInvalid: prepared.skippedInvalid + fromText.skippedInvalid,
                skippedDuplicate: prepared.skippedDuplicate + fromText.skippedDuplicate,
            };
        }

        toolsRepaired += prepared.repairedCount;
        toolsSkippedInvalid += prepared.skippedInvalid;
        toolsSkippedDuplicate += prepared.skippedDuplicate;

        const toolCalls = prepared.calls;
        const cleanedAssistant =
            stripToolCallSyntax(content) || textParsed.cleanedContent || null;

        if (toolCalls.length === 0) {
            // Pure duplicate of an already-executed call (Kimi loop shape): do not re-run;
            // inject note and finish with a no-tools answer pass.
            if (candidateCount > 0 && prepared.skippedDuplicate > 0) {
                agentMessages.push({
                    role: 'assistant',
                    content: cleanedAssistant || content || '(duplicate tool call)',
                });
                agentMessages.push({
                    role: 'user',
                    content: DUPLICATE_TOOL_CALL_NOTE,
                });
                stopReason = 'duplicate_call';
                logToolTelemetry('agent_duplicate_call', {
                    model,
                    rounds,
                    skippedDuplicate: prepared.skippedDuplicate,
                });
                break;
            }

            if (textParsed.lookedLikeToolDump && round < maxRounds - 1) {
                agentMessages.push({
                    role: 'assistant',
                    content: content || '(tool syntax)',
                });
                agentMessages.push({ role: 'user', content: TEXT_TOOL_NUDGE });
                continue;
            }

            // If we already used tools and this is the last allowed round, discard
            // last-round narration and force a clean final pass (exhaustion UX).
            if (usedTools && rounds >= maxRounds) {
                // Do not push narration into the final answer path.
                stopReason = 'max_rounds';
                break;
            }

            const safe = finalizeUserFacingContent(content, reasoning);
            logToolTelemetry('agent_complete', {
                model,
                mode: capability.mode,
                rounds,
                usedTools,
                toolCallSource,
                toolsRepaired,
                toolsSkippedInvalid,
                toolsSkippedDuplicate,
            });
            return {
                content: safe,
                reasoning,
                ...baseResultFields({
                    usedTools,
                    rounds,
                    toolCallSource,
                    toolsRepaired,
                    toolsSkippedInvalid,
                    toolsSkippedDuplicate,
                    capabilityMode: capability.mode,
                    usage: lastUsage,
                    cumulativePromptTokens,
                    stopReason: 'complete',
                }),
            };
        }

        usedTools = true;
        toolCallSource = mergeToolSource(
            toolCallSource,
            toolCalls.map((c) => c.origin)
        );

        for (const call of toolCalls) {
            executedKeys.add(toolCallDedupeKey(call));
        }

        const useTextProtocol =
            capability.preferTextResultProtocol
            || toolCalls.every((c) => c.origin === 'text');

        if (useTextProtocol) {
            agentMessages.push({
                role: 'assistant',
                content: cleanedAssistant,
            });
            const results = await executeToolCalls(toolCalls);
            agentMessages.push({
                role: 'user',
                content: formatToolResultsForModel(results),
            });
        } else {
            agentMessages.push({
                role: 'assistant',
                content: cleanedAssistant,
                tool_calls: toolCalls.map((call) => ({
                    id: call.id,
                    type: 'function' as const,
                    function: { name: call.name, arguments: call.arguments },
                })),
            });
            const results = await executeToolCalls(toolCalls);
            for (const result of results) {
                agentMessages.push({
                    role: 'tool',
                    tool_call_id: result.toolCallId,
                    name: result.name,
                    content: result.content,
                });
            }
        }

        // After executing tools, if budget is exhausted, stop further tool rounds.
        if (cumulativePromptTokens >= turnBudget) {
            stopReason = 'token_budget';
            logToolTelemetry('agent_token_budget', {
                model,
                cumulative: cumulativePromptTokens,
                budget: turnBudget,
            });
            break;
        }
    }

    if (stopReason === 'complete' && rounds >= maxRounds) {
        stopReason = 'max_rounds';
    }

    logToolTelemetry('agent_max_rounds', {
        model,
        mode: capability.mode,
        rounds,
        toolCallSource,
        toolsRepaired,
        stopReason,
    });

    // Discard any last-round loop narration; only the final no-tools pass may ship.
    return runFinalNoToolsPass(agentMessages, settings, model, {
        usedTools,
        rounds,
        toolCallSource,
        toolsRepaired,
        toolsSkippedInvalid,
        toolsSkippedDuplicate,
        capabilityMode: capability.mode,
        lastUsage,
        cumulativePromptTokens,
        stopReason,
    });
}
