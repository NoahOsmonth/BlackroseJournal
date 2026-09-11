/**
 * Client-side agent loop with local history tools — Pi turn semantics.
 *
 * A **turn** is one LLM call plus zero-or-more tool executions. The loop only
 * finishes on a turn that has no tool calls and no unfinished-promise language,
 * so free models that say "let me dig more" actually dig more instead of
 * shipping a status line as the reply.
 *
 * Pipeline (2026-style):
 *   1. structured tool_calls from the provider
 *   2. local schema validate + repair + dedupe
 *   3. text pseudo-code parse (degraded free-model path)
 *   4. execute on device, feed results, loop
 *   5. promise keep-alive (max 2 extra turns) before accepting a final answer
 *
 * PR8c hardening (kept):
 *   - AGENT_TURN_TOKEN_BUDGET cumulative across turns
 *   - repeated identical tool-call → note + final no-tools pass
 *   - max-round exhaustion never ships loop narration
 */

import {
    DEFAULT_GENERATION,
    type GenerationSettings,
    sanitizeGenerationSettings,
} from './generationSettings';
import { fetchAiChatCompletion } from './aiTransport';
import { latestUserText, selectToolShortlist } from './agenticGate';
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
import type { AgentMessage, ToolCall, ToolDefinition, ToolResult } from './tools/types';
import type { Message } from './chatTypes';
import type {
    AgentActivityListener,
    AgentStopReason,
} from './agentEvents';
import {
    looksLikeUnfinishedPromise,
    PROMISE_CONTINUATION_MAX,
    PROMISE_CONTINUE_NOTE,
    PROMISE_STOP_NOTE,
} from './agentPromise';
import {
    resolveFinishReason,
    resolveStopMapping,
    TOOLUSE_NO_CALLS_NOTE,
    TRUNCATED_TOOL_NOTE,
    type AgentProviderStopReason,
} from './agentStopReason';
import {
    activityEmitter,
    emitAssistantText,
    emitToolCallEnds,
    emitToolCallErrors,
    emitToolCallStarts,
} from './agentEmit';
import { estimateTokensFromChars, extractUsageFromCompletion } from './promptBudget';

/** Per-turn sequence for idempotency run ids (module-local; resets on reload). */
let agentTurnSeq = 0;

/**
 * Max non-streaming tool turns per agent turn. 6 turns so multi-step questions
 * (search → day → conversation) can complete; the cumulative token budget and
 * the wall-clock timeout still bound runaway loops.
 */
export const MAX_AGENT_TOOL_ROUNDS = 6;
/**
 * Hard cap for non-streaming tool turns. Settings often allow 32k max_tokens;
 * free reasoning models will spend that budget on chain-of-thought and the UI
 * sits on a typing indicator until the entire turn finishes.
 */
export const AGENT_ROUND_MAX_TOKENS = 1_536;

/**
 * Whole-turn wall-clock deadline for the agent loop. When exceeded at the top
 * of a turn, tool turns abort and a final no-tools pass runs. 45s: more turns
 * on slower free models need more wall-clock; the deadline still cuts tool
 * turns and ships a final no-tools answer.
 */
export const AGENT_TURN_TIMEOUT_MS = 45_000;

/**
 * PR8c: cumulative prompt-token budget across all tool turns of one agent turn.
 * Real usage.prompt_tokens when available; chars/4 estimator otherwise.
 * Tools-schema + framing often add ~900 real tokens/turn outside the system string.
 */
export const AGENT_TURN_TOKEN_BUDGET = 24_000;

/**
 * User-visible fallback when tool turns exhaust and the final no-tools pass
 * fails, returns empty, or returns another status line. Never loop narration.
 */
export const AGENT_EXHAUSTION_FALLBACK =
    'I looked through what is on this device, but I am having trouble putting the answer into words. Try asking once more, or rephrase slightly.';

/**
 * Injected when the model repeats an identical tool name + args already executed
 * this turn. Triggers the final no-tools pass.
 */
export const DUPLICATE_TOOL_CALL_NOTE =
    'System note: duplicate call — you already have these results; answer with what you have.';

/**
 * Injected at most once per turn when a tool batch comes back thin (errors,
 * empty, or explicit no-match), giving the model one explicit chance to retry
 * with different terms, a broader date range, or a different tool before the
 * turn cap cuts it off.
 */
export const THIN_RESULT_RETRY_NOTE =
    'System note: the last tool call(s) returned no useful results. If you believe relevant information exists, try again with different terms, a broader date range, or a different tool. Otherwise answer from what you already have. Never invent results.';

export { PROMISE_CONTINUATION_MAX, PROMISE_CONTINUE_NOTE } from './agentPromise';

export class ToolsUnsupportedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ToolsUnsupportedError';
    }
}

export type AgentToolCallSource = 'structured' | 'text' | 'mixed' | 'none';

export type AgentTokenSource = 'real' | 'est';

/** Wall-clock timing for one agent turn (Task 8). */
export interface AgentLoopTimings {
    turnMs: number;
    roundMs: number[];
    toolBatchMs: number[];
    toolsExecuted: number;
}

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
    /** Provider usage from the last completion turn (when present). */
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
    /** Cumulative prompt tokens billed to the turn budget (real or est). */
    cumulativePromptTokens?: number;
    /** Why the loop stopped early, if applicable. */
    stopReason?: AgentStopReason;
    /** Wall-clock timing for turns and tool batches (Task 8). */
    timings?: AgentLoopTimings;
    /**
     * Status lines the model wrote between tool turns (not the final answer).
     * Kept for tests/telemetry — the UI consumes the same text via events.
     */
    intermediateTexts?: { round: number; text: string }[];
    /** How many keep-alive nudges the promise detector spent this turn. */
    promiseContinuations?: number;
    /** Raw provider finish_reason for the last turn (Pi: stop ≠ tool_use ≠ length). */
    providerStopReason?: AgentProviderStopReason;
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
    /** Override whole-turn wall-clock deadline (tests). Defaults to AGENT_TURN_TIMEOUT_MS. */
    turnTimeoutMs?: number;
    /** Optional live activity listener for the visible tool timeline (UI). */
    onActivity?: AgentActivityListener;
}

/**
 * Record dedupe keys only for calls that actually executed. REFUSED calls
 * never ran, so a later re-request of the same call stays eligible.
 */
function markExecutedKeys(
    toolCalls: readonly { id: string; name: string; arguments: string }[],
    results: readonly ToolResult[]
): Set<string> {
    const keys = new Set<string>();
    toolCalls.forEach((call, index) => {
        if (!results[index]?.refused) {
            keys.add(toolCallDedupeKey(call));
        }
    });
    return keys;
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

/**
 * A tool result is "thin" when it offers the model nothing to answer from:
 * an execution error, empty content, or an explicit no-match / timeout marker.
 */
function isThinToolResult(result: ToolResult): boolean {
    if (result.isError) return true;
    const trimmed = result.content.trim();
    if (!trimmed) return true;
    return (
        trimmed.startsWith('No ')
        || trimmed.startsWith('Error')
        || trimmed.startsWith('[tool:')
    );
}

function agentRoundMaxTokens(settings: GenerationSettings): number {
    return Math.min(settings.maxTokens, AGENT_ROUND_MAX_TOKENS);
}

/** Estimate prompt tokens for a turn when the provider omits usage (chars/4). */
export function estimateAgentRoundPromptTokens(
    agentMessages: readonly AgentMessage[],
    sendTools: boolean,
    toolDefs: readonly ToolDefinition[] = HISTORY_TOOL_DEFINITIONS
): number {
    let chars = 0;
    try {
        chars += JSON.stringify(agentMessages).length;
    } catch {
        chars += agentMessages.reduce((sum, m) => sum + (m.content?.length ?? 0), 0);
    }
    if (sendTools) {
        try {
            chars += JSON.stringify(toOpenAiToolSpecs(toolDefs)).length;
        } catch {
            chars += 3_600; // ~tools-schema framing ballpark
        }
    }
    return estimateTokensFromChars(chars);
}

function accountRoundTokens(
    data: unknown,
    agentMessages: readonly AgentMessage[],
    sendTools: boolean,
    toolDefs: readonly ToolDefinition[] = HISTORY_TOOL_DEFINITIONS
): { tokens: number; source: AgentTokenSource } {
    const usage = extractUsageFromCompletion(data);
    if (usage && typeof usage.prompt_tokens === 'number' && Number.isFinite(usage.prompt_tokens)) {
        return { tokens: usage.prompt_tokens, source: 'real' };
    }
    return {
        tokens: estimateAgentRoundPromptTokens(agentMessages, sendTools, toolDefs),
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
    console.log(
        `[agent-loop] turn=${options.round} tokens=${options.tokens} source=${options.source} `
        + `cumulative=${options.cumulative} budget=${options.budget}`
    );
}

async function completeWithTools(
    agentMessages: AgentMessage[],
    settings: GenerationSettings,
    model: string,
    sendTools: boolean,
    toolDefs: readonly ToolDefinition[] = HISTORY_TOOL_DEFINITIONS
): Promise<unknown> {
    const response = await fetchAiChatCompletion({
        model,
        messages: agentMessages as unknown as { role: string; content: string }[],
        stream: false,
        temperature: settings.temperature,
        top_p: settings.topP,
        max_tokens: agentRoundMaxTokens(settings),
        ...(sendTools
            ? {
                tools: toOpenAiToolSpecs(toolDefs),
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
    const response = await fetchAiChatCompletion({
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
    stopReason: AgentStopReason;
    intermediateTexts: { round: number; text: string }[];
    promiseContinuations: number;
    providerStopReason: AgentProviderStopReason;
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
        intermediateTexts: options.intermediateTexts,
        promiseContinuations: options.promiseContinuations,
        providerStopReason: options.providerStopReason,
    };
}

/**
 * Final no-tools pass after tool turns stop (budget / duplicate / max turns /
 * promise exhaustion). Never returns loop narration and never returns a
 * "one sec" status line: empty, failed, or promise-shaped → the fallback.
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
        stopReason: AgentStopReason;
        timings: AgentLoopTimings;
        intermediateTexts: { round: number; text: string }[];
        promiseContinuations: number;
        providerStopReason: AgentProviderStopReason;
    }
): Promise<AgentLoopResult> {
    const fallback = (reasoning: string, usage: AgentLoopResult['usage']): AgentLoopResult => ({
        content: AGENT_EXHAUSTION_FALLBACK,
        reasoning,
        timings: meta.timings,
        ...baseResultFields({ ...meta, usage }),
    });

    try {
        const final = await completeWithoutTools(agentMessages, settings, model);
        const safe = finalizeUserFacingContent(final.content, final.reasoning);
        const usage = final.usage ?? meta.lastUsage;
        // A status line is never a final answer, even from the tools-disabled pass.
        if (!safe.trim() || looksLikeUnfinishedPromise(safe)) {
            return fallback(final.reasoning, usage);
        }
        return {
            content: safe,
            reasoning: final.reasoning,
            timings: meta.timings,
            ...baseResultFields({ ...meta, usage }),
        };
    } catch (error) {
        console.warn('Agent final no-tools pass failed:', error);
        return fallback('', meta.lastUsage);
    }
}

export async function runAgentTurnWithTools(options: AgentLoopOptions): Promise<AgentLoopResult> {
    const settings = sanitizeGenerationSettings(options.generation ?? DEFAULT_GENERATION);
    const maxRounds = options.maxRounds ?? MAX_AGENT_TOOL_ROUNDS;
    const model = options.model ?? 'agent-default';
    const capability = options.capability ?? resolveToolCapability(model);
    const turnBudget = options.turnTokenBudget ?? AGENT_TURN_TOKEN_BUDGET;
    const turnTimeoutMs = options.turnTimeoutMs ?? AGENT_TURN_TIMEOUT_MS;

    // Task 8: wall-clock timing for the whole turn, per turn, and per tool batch.
    const turnStartedAt = Date.now();
    const roundMs: number[] = [];
    const toolBatchMs: number[] = [];
    let toolsExecuted = 0;

    if (!capability.runAgentLoop) {
        logToolTelemetry('agent_skipped_inject_only', { model, mode: capability.mode });
        return emptyResult(capability.mode);
    }

    const agentMessages = buildAgentMessages(options.systemPrompt, options.messages);
    const executedKeys = new Set<string>();
    // Idempotency scope for this turn: identical calls share one execution.
    const runId = `agent_${Date.now().toString(36)}_${(agentTurnSeq += 1)}`;
    const emitActivity = activityEmitter(options.onActivity, runId);
    // Per-turn shortlist: send only the specs this turn plausibly needs.
    const shortlist = selectToolShortlist(latestUserText(options.messages));
    const shortlisted = HISTORY_TOOL_DEFINITIONS.filter((def) =>
        shortlist.names.includes(def.name)
    );
    const activeToolDefs = shortlisted.length > 0 ? shortlisted : HISTORY_TOOL_DEFINITIONS;
    logToolTelemetry('agent_tool_shortlist', {
        model,
        branch: shortlist.branch,
        specs: activeToolDefs.length,
    });

    let usedTools = false;
    let rounds = 0;
    let toolCallSource: AgentToolCallSource = 'none';
    let toolsRepaired = 0;
    let toolsSkippedInvalid = 0;
    let toolsSkippedDuplicate = 0;
    let sendTools = capability.sendToolsInApi;
    let lastUsage: AgentLoopResult['usage'] = null;
    let cumulativePromptTokens = 0;
    let stopReason: AgentStopReason = 'complete';
    // Structured|text|mixed ratio for this turn (text-dump demotion tuning).
    let structuredCallCount = 0;
    let textCallCount = 0;
    // One-shot thin-result retry nudge: at most one per turn; the turn cap bounds the rest.
    let retryNudged = false;
    // Pi keep-alive: turns continued purely because the model promised to keep looking.
    let promiseContinuations = 0;
    // Truncated tool calls: at most one re-issue nudge per turn.
    let truncationNudged = false;
    // Tool-use claims with nothing parsed: at most one nudge per turn.
    let toolUseNoCallsNudged = false;
    let providerStopReason: AgentProviderStopReason = 'unknown';
    /** Status lines the model wrote on turns that were not the final answer. */
    const intermediateTexts: { round: number; text: string }[] = [];

    /** Record + publish a non-final assistant line (working status for the UI). */
    const captureIntermediateText = (round: number, text: string | null | undefined) => {
        const trimmed = (text ?? '').trim();
        if (!trimmed) return;
        emitAssistantText(round, trimmed, emitActivity);
        intermediateTexts.push({ round, text: trimmed });
    };

    let agentEndEmitted = false;
    const emitAgentEnd = (reason?: AgentStopReason) => {
        if (agentEndEmitted) return;
        agentEndEmitted = true;
        emitActivity({
            type: 'agent_end',
            usedTools,
            rounds,
            ...(reason ? { stopReason: reason } : {}),
        });
    };

    emitActivity({ type: 'agent_start', runId });

    try {
        for (let round = 0; round < maxRounds; round += 1) {
        // Cross-turn budget: do not start another model+tools turn if already over.
        if (round > 0 && cumulativePromptTokens >= turnBudget) {
            stopReason = 'token_budget';
            logToolTelemetry('agent_token_budget', {
                model,
                cumulative: cumulativePromptTokens,
                budget: turnBudget,
            });
            break;
        }

        // Whole-turn wall-clock deadline: abort tool turns; the final no-tools
        // pass below still ships an answer.
        if (Date.now() - turnStartedAt > turnTimeoutMs) {
            stopReason = 'timeout';
            logToolTelemetry('agent_timeout', {
                model,
                rounds,
                turnMs: Date.now() - turnStartedAt,
            });
            break;
        }

        rounds = round + 1;
        emitActivity({ type: 'turn_start', round: rounds });
        const roundStart = Date.now();
        let data: unknown;
        try {
            data = await completeWithTools(agentMessages, settings, model, sendTools, activeToolDefs);
        } catch (error) {
            if (error instanceof ToolsUnsupportedError && sendTools) {
                // Provider rejected tools mid-session — fall back to text-only completion once.
                sendTools = false;
                markToolsUnsupported(model);
                data = await completeWithTools(agentMessages, settings, model, false, activeToolDefs);
            } else {
                throw error;
            }
        }

        lastUsage = extractUsageFromCompletion(data) ?? lastUsage;

        const accounted = accountRoundTokens(data, agentMessages, sendTools, activeToolDefs);
        cumulativePromptTokens += accounted.tokens;
        logRoundTokenBudget({
            round: rounds,
            tokens: accounted.tokens,
            source: accounted.source,
            cumulative: cumulativePromptTokens,
            budget: turnBudget,
        });
        roundMs.push(Date.now() - roundStart);

        const structuredCalls = extractToolCalls(data);
        const { content, reasoning } = extractAssistantContent(data);
        providerStopReason = resolveFinishReason(data);

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

        // Pi: a truncated tool call is not executable — its arguments are cut
        // mid-JSON, so validation drops it and its results would be garbage.
        // Decide on the RAW candidate count: repair is expected to reject these.
        const stopMapping = resolveStopMapping(providerStopReason, candidateCount);
        if (stopMapping === 'truncated_tools') {
            const truncated = [
                ...structuredCalls.map((call) => ({ ...call, origin: 'structured' as const })),
                ...textParsed.toolCalls.map((call) => ({ ...call, origin: 'text' as const })),
            ];
            emitToolCallErrors(truncated, rounds, 'arguments truncated — re-issue', emitActivity);
            logToolTelemetry('agent_length_truncate', {
                model,
                rounds,
                providerStopReason,
                callCount: truncated.length,
            });
            if (!truncationNudged && round < maxRounds - 1) {
                truncationNudged = true;
                // No assistant tool_calls here: an unanswered tool_call in the
                // transcript makes OpenAI-shaped gateways reject the next turn.
                agentMessages.push({
                    role: 'assistant',
                    content: cleanedAssistant || '(truncated tool call)',
                });
                agentMessages.push({ role: 'user', content: TRUNCATED_TOOL_NOTE });
                emitActivity({ type: 'follow_up_injected', reason: 'truncated_tools' });
                captureIntermediateText(rounds, cleanedAssistant);
                emitActivity({ type: 'turn_end', round: rounds, hasToolCalls: false });
                continue;
            }
            emitActivity({ type: 'turn_end', round: rounds, hasToolCalls: false });
            stopReason = 'error';
            break;
        }

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
                captureIntermediateText(rounds, cleanedAssistant);
                stopReason = 'duplicate_call';
                logToolTelemetry('agent_duplicate_call', {
                    model,
                    rounds,
                    skippedDuplicate: prepared.skippedDuplicate,
                });
                emitActivity({ type: 'turn_end', round: rounds, hasToolCalls: false });
                break;
            }

            // Free-model nudge: a dump-shaped turn with nothing parsed means the
            // tools API did not take (weak models ignore it and write the call as
            // prose). Tier A models DO deliver their calls through that API, so a
            // dump there is confusion, not a protocol gap — nudging would just buy
            // another dump. Hand it to the forced final pass instead; either way
            // the raw syntax never reaches the diary.
            if (textParsed.lookedLikeToolDump && round < maxRounds - 1) {
                if (capability.mode === 'structured') {
                    logToolTelemetry('agent_dump_no_nudge', {
                        model,
                        rounds,
                        mode: capability.mode,
                    });
                    emitActivity({ type: 'turn_end', round: rounds, hasToolCalls: false });
                    stopReason = 'skipped';
                    break;
                }
                agentMessages.push({
                    role: 'assistant',
                    content: content || '(tool syntax)',
                });
                agentMessages.push({ role: 'user', content: TEXT_TOOL_NUDGE });
                emitActivity({ type: 'turn_end', round: rounds, hasToolCalls: false });
                continue;
            }

            // Pi: the provider claimed tool use but nothing survived parsing.
            // Do not finalize on that — nudge for a real call, or a real answer.
            if (providerStopReason === 'tool_use') {
                logToolTelemetry('agent_tooluse_no_calls', {
                    model,
                    rounds,
                    candidates: candidateCount,
                });
                if (!toolUseNoCallsNudged && round < maxRounds - 1) {
                    toolUseNoCallsNudged = true;
                    agentMessages.push({
                        role: 'assistant',
                        content: cleanedAssistant || '(tool use indicated)',
                    });
                    agentMessages.push({ role: 'user', content: TOOLUSE_NO_CALLS_NOTE });
                    emitActivity({ type: 'follow_up_injected', reason: 'tooluse_no_calls' });
                    captureIntermediateText(rounds, cleanedAssistant);
                    emitActivity({ type: 'turn_end', round: rounds, hasToolCalls: false });
                    continue;
                }
                // Nudge spent and the provider still claims a tool call with
                // nothing to run: force a tools-disabled pass, never ship "".
                emitActivity({ type: 'turn_end', round: rounds, hasToolCalls: false });
                stopReason = 'error';
                break;
            }

            const safe = finalizeUserFacingContent(content, reasoning);
            const promisedMore = looksLikeUnfinishedPromise(safe);
            const budgetLeft = cumulativePromptTokens < turnBudget;
            const timeLeft = Date.now() - turnStartedAt < turnTimeoutMs;

            // Pi keep-alive: a status line is not an answer. Nudge and run another
            // turn — capped so a model stuck on "one sec" cannot loop forever.
            if (
                promisedMore
                && promiseContinuations < PROMISE_CONTINUATION_MAX
                && round < maxRounds - 1
                && budgetLeft
                && timeLeft
            ) {
                promiseContinuations += 1;
                captureIntermediateText(rounds, safe);
                agentMessages.push({ role: 'assistant', content: safe });
                agentMessages.push({ role: 'user', content: PROMISE_CONTINUE_NOTE });
                emitActivity({ type: 'follow_up_injected', reason: 'promised_more' });
                logToolTelemetry('agent_promise_continue', {
                    model,
                    rounds,
                    promiseContinuations,
                });
                emitActivity({ type: 'turn_end', round: rounds, hasToolCalls: false });
                continue;
            }

            // Still promising but out of continuations/rounds/budget: never ship the
            // status line — force a "you are done looking" final pass instead.
            if (promisedMore) {
                captureIntermediateText(rounds, safe);
                agentMessages.push({ role: 'assistant', content: safe });
                agentMessages.push({ role: 'user', content: PROMISE_STOP_NOTE });
                stopReason = 'promised_more_timeout';
                logToolTelemetry('agent_promise_exhausted', {
                    model,
                    rounds,
                    promiseContinuations,
                });
                emitActivity({ type: 'turn_end', round: rounds, hasToolCalls: false });
                break;
            }

            // If we already used tools and this is the last allowed turn, discard
            // last-turn narration and force a clean final pass (exhaustion UX).
            if (usedTools && rounds >= maxRounds) {
                captureIntermediateText(rounds, safe);
                emitActivity({ type: 'turn_end', round: rounds, hasToolCalls: false });
                stopReason = 'max_rounds';
                break;
            }

            // Strict finality: an empty turn is not an answer. A model that
            // returned nothing (or only unparseable tool syntax) hands off to the
            // forced no-tools pass, which owns the exhaustion fallback — the user
            // never gets a blank diary entry.
            if (!safe.trim()) {
                logToolTelemetry('agent_empty_final', {
                    model,
                    rounds,
                    providerStopReason,
                });
                emitActivity({ type: 'turn_end', round: rounds, hasToolCalls: false });
                stopReason = 'skipped';
                break;
            }

            const timings = {
                turnMs: Date.now() - turnStartedAt,
                roundMs,
                toolBatchMs,
                toolsExecuted,
            };
            logToolTelemetry('agent_complete', {
                model,
                mode: capability.mode,
                rounds,
                usedTools,
                toolCallSource,
                structuredCalls: structuredCallCount,
                textCalls: textCallCount,
                toolsRepaired,
                toolsSkippedInvalid,
                toolsSkippedDuplicate,
                roundMs: roundMs[roundMs.length - 1],
                toolBatchMs: toolBatchMs[toolBatchMs.length - 1] ?? 0,
                turnMs: timings.turnMs,
                promiseContinuations,
            });
            emitActivity({ type: 'turn_end', round: rounds, hasToolCalls: false });
            return {
                content: safe,
                reasoning,
                timings,
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
                    intermediateTexts,
                    promiseContinuations,
                    providerStopReason,
                }),
            };
        }

        usedTools = true;
        toolCallSource = mergeToolSource(
            toolCallSource,
            toolCalls.map((c) => c.origin)
        );
        structuredCallCount += toolCalls.filter((c) => c.origin === 'structured').length;
        textCallCount += toolCalls.filter((c) => c.origin === 'text').length;

        const useTextProtocol =
            capability.preferTextResultProtocol
            || toolCalls.every((c) => c.origin === 'text');

        if (useTextProtocol) {
            agentMessages.push({
                role: 'assistant',
                content: cleanedAssistant,
            });
            // Pi order: the assistant's words for this turn land before its tools.
            captureIntermediateText(rounds, cleanedAssistant);
            const startedAtByCallId = emitToolCallStarts(toolCalls, rounds, emitActivity);
            const batchStart = Date.now();
            const results = await executeToolCalls(toolCalls, { runId });
            emitToolCallEnds(toolCalls, results, startedAtByCallId, rounds, emitActivity);
            for (const key of markExecutedKeys(toolCalls, results)) {
                executedKeys.add(key);
            }
            toolBatchMs.push(Date.now() - batchStart);
            toolsExecuted += results.length;
            agentMessages.push({
                role: 'user',
                content: formatToolResultsForModel(results),
            });
            if (!retryNudged && results.length > 0 && results.every(isThinToolResult)) {
                agentMessages.push({ role: 'user', content: THIN_RESULT_RETRY_NOTE });
                retryNudged = true;
                emitActivity({ type: 'follow_up_injected', reason: 'thin_result' });
            }
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
            captureIntermediateText(rounds, cleanedAssistant);
            const startedAtByCallId = emitToolCallStarts(toolCalls, rounds, emitActivity);
            const batchStart = Date.now();
            const results = await executeToolCalls(toolCalls, { runId });
            emitToolCallEnds(toolCalls, results, startedAtByCallId, rounds, emitActivity);
            for (const key of markExecutedKeys(toolCalls, results)) {
                executedKeys.add(key);
            }
            toolBatchMs.push(Date.now() - batchStart);
            toolsExecuted += results.length;
            for (const result of results) {
                agentMessages.push({
                    role: 'tool',
                    tool_call_id: result.toolCallId,
                    name: result.name,
                    content: result.content,
                });
            }
            if (!retryNudged && results.length > 0 && results.every(isThinToolResult)) {
                agentMessages.push({ role: 'user', content: THIN_RESULT_RETRY_NOTE });
                retryNudged = true;
                emitActivity({ type: 'follow_up_injected', reason: 'thin_result' });
            }
        }

        emitActivity({ type: 'turn_end', round: rounds, hasToolCalls: true });

        // After executing tools, if budget is exhausted, stop further tool turns.
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

        const timings = {
            turnMs: Date.now() - turnStartedAt,
            roundMs,
            toolBatchMs,
            toolsExecuted,
        };

        logToolTelemetry('agent_max_rounds', {
            model,
            mode: capability.mode,
            rounds,
            toolCallSource,
            structuredCalls: structuredCallCount,
            textCalls: textCallCount,
            toolsRepaired,
            stopReason,
            providerStopReason,
            promiseContinuations,
            roundMs: roundMs[roundMs.length - 1],
            toolBatchMs: toolBatchMs[toolBatchMs.length - 1] ?? 0,
            turnMs: timings.turnMs,
        });

        // Discard any last-turn loop narration; only the final no-tools pass may ship.
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
            timings,
            intermediateTexts,
            promiseContinuations,
            providerStopReason,
        });
    } finally {
        emitAgentEnd(stopReason);
    }
}
