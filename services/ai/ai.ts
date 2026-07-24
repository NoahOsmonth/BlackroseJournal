import { THERAPIST_SYSTEM_PROMPT } from '@/constants/aiPrompts';
import { runAgentTurnWithTools, ToolsUnsupportedError } from './agentLoop';
import {
    buildChatPayload,
    ChatAccumulator,
    CompleteCallback,
    ErrorCallback,
    Message,
    resolveStreamOptions,
    StreamChatOptions,
    StreamingCallback,
} from './chatTypes';
import {
    compactConversationIfNeeded,
    DEFAULT_COMPACT_CONTEXT_WINDOW,
    DEFAULT_OUTPUT_RESERVE,
} from './conversationCompact';
import { getKnownContextWindow } from './customModels';
import { getResolvedDirectConfig } from './directConfig';
import { augmentSystemPromptForTurn, detectHistoryIntent } from './historyPrefetch';
import {
    attachRealUsage,
    buildLedgerFromAssembledRequest,
    logPromptBudget,
    type HistoryToolsBranch,
} from './promptBudget';
import {
    buildResponseError,
    emitSimulatedStreaming,
    readNonStreamingResponse,
    readStreamResponse,
} from './sseParser';
import {
    fetchChatCompletion,
    hasReadableStream,
    streamChatWithXhr,
} from './streamingTransports';
import { HISTORY_TOOLS_POLICY } from './tools';
import { stripToolCallSyntax } from './tools/parseTextToolCalls';
import {
    logToolTelemetry,
    markToolsUnsupported,
    resolveToolCapability,
} from './tools/toolCapability';

export {
    CompleteCallback,
    ErrorCallback, Message, StreamChatOptions, StreamingCallback
} from './chatTypes';
export type { ChatAccumulator } from './chatTypes';
export type { HistoryToolsBranch } from './promptBudget';
export { useChat } from './useChat';

const DEFAULT_DIRECT_MODEL = 'agent-default';

/** Proactive tool triggers beyond pure history Q&A (rants, first turns, night cues). */
const PROACTIVE_TOOL_RE =
    /\b(tired|exhausted|can'?t sleep|insomnia|night|tonight|this morning|today|work|boss|always|never|again|spiral|anxious|anxiety|overwhelmed|rant|finally|anyway)\b/i;

function normalizeUnknownError(error: unknown): Error {
    if (error instanceof Error) return error;
    if (typeof error === 'string') return new Error(error);
    try {
        return new Error(JSON.stringify(error));
    } catch {
        return new Error('Unknown error occurred');
    }
}

function latestUserText(messages: Message[]): string {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        if (messages[i].role === 'user') return messages[i].content;
    }
    return '';
}

/**
 * Proactive tools by default (curiosity / clock / history), without forcing an
 * agent-loop round-trip on every tiny "hi" — that would kill mobile latency.
 * Pass enableHistoryTools: true to always try tools; false to never.
 */
/** Synthetic bootstrap lines used to start guided chats — not real user text. */
const BOOTSTRAP_TRIGGER_RE = /^\[Start\b/i;

/**
 * Which shouldEnableHistoryTools arm fired (instrumentation / prompt-budget).
 * Mirrors the boolean gate exactly — first matching branch wins.
 */
export function resolveHistoryToolsBranch(
    flag: StreamChatOptions['enableHistoryTools'],
    userText: string,
    messages: readonly Message[],
): HistoryToolsBranch {
    if (flag === false) return 'forced-false';
    if (flag === true) return 'forced-true';
    const trimmed = userText.trim();
    if (BOOTSTRAP_TRIGGER_RE.test(trimmed)) return 'bootstrap';
    if (detectHistoryIntent(trimmed)) return 'historyIntent';
    if (trimmed.length >= 80) return 'length>=80';
    if (PROACTIVE_TOOL_RE.test(trimmed)) return 'PROACTIVE_RE';
    const userTurns = messages.filter((m) => m.role === 'user').length;
    if (userTurns <= 2 && trimmed.length >= 12) return 'first-turns';
    return 'none';
}

export function shouldEnableHistoryTools(
    flag: StreamChatOptions['enableHistoryTools'],
    userText: string,
    messages: readonly Message[]
): boolean {
    const branch = resolveHistoryToolsBranch(flag, userText, messages);
    return branch !== 'forced-false' && branch !== 'bootstrap' && branch !== 'none';
}

/** Local-only context window resolve — no network hang on mobile offline. */
async function resolveContextWindow(): Promise<number> {
    try {
        const config = await getResolvedDirectConfig();
        if (config.contextWindow && config.contextWindow > 0) {
            return config.contextWindow;
        }
        const known = getKnownContextWindow(config.model);
        if (known && known > 0) return known;
    } catch {
        // Missing key / offline — fall through.
    }
    return DEFAULT_COMPACT_CONTEXT_WINDOW;
}

/** Resolve active model id for capability routing (local settings only). */
async function resolveActiveModelId(): Promise<string> {
    try {
        const config = await getResolvedDirectConfig();
        if (config.model) return config.model;
    } catch {
        // Missing key / offline.
    }
    return DEFAULT_DIRECT_MODEL;
}

export async function streamChat(
    messages: Message[],
    onChunk: StreamingCallback,
    onComplete: CompleteCallback,
    onError: ErrorCallback,
    options?: string | StreamChatOptions
): Promise<void> {
    try {
        const resolved = resolveStreamOptions(options);
        let systemPrompt = resolved.systemPrompt || THERAPIST_SYSTEM_PROMPT;
        const userText = latestUserText(messages);
        const toolsBranch = resolveHistoryToolsBranch(
            resolved.enableHistoryTools,
            userText,
            messages
        );
        const toolsEnabled = shouldEnableHistoryTools(
            resolved.enableHistoryTools,
            userText,
            messages
        );

        const contextWindow = await resolveContextWindow();
        const activeModelId = await resolveActiveModelId();
        const capability = resolveToolCapability(activeModelId);
        const outputReserve = Math.min(
            DEFAULT_OUTPUT_RESERVE,
            Math.max(512, Math.floor(contextWindow * 0.12))
        );

        // Auto-compact older turns when free/small context windows fill up.
        const compactResult = compactConversationIfNeeded(messages, {
            systemPrompt,
            contextWindow,
            outputReserve,
        });
        const outboundMessages = compactResult.messages;

        let eagerAugmentationText: string | undefined;
        let lastUsage: { prompt_tokens?: number } | null = null;

        // Eager digests whenever history tools would help (even inject-only models).
        if (toolsEnabled) {
            const beforeAugment = systemPrompt;
            systemPrompt = await augmentSystemPromptForTurn(systemPrompt, userText);
            if (systemPrompt.length > beforeAugment.length) {
                // augmentSystemPromptForTurn joins with "\n\n"
                eagerAugmentationText = systemPrompt.slice(beforeAugment.length).replace(/^\n\n/, '');
            }

            // inject_only: digests + clock in prompt, skip tools API agent loop.
            if (capability.runAgentLoop) {
                try {
                    const preLedger = buildLedgerFromAssembledRequest({
                        systemPrompt,
                        messages: outboundMessages,
                        toolsBranch,
                        includeToolsSchema: true,
                        eagerAugmentationText,
                    });

                    const agentResult = await runAgentTurnWithTools({
                        systemPrompt,
                        messages: outboundMessages,
                        generation: resolved.generation,
                        model: DEFAULT_DIRECT_MODEL,
                        capability,
                    });
                    lastUsage = agentResult.usage ?? null;
                    logPromptBudget(attachRealUsage(preLedger, lastUsage));
                    if (lastUsage) {
                        // eslint-disable-next-line no-console
                        console.log('[prompt-budget] usage', JSON.stringify(lastUsage));
                    }
                    logToolTelemetry('stream_agent_result', {
                        model: activeModelId,
                        mode: agentResult.capabilityMode,
                        toolCallSource: agentResult.toolCallSource,
                        usedTools: agentResult.usedTools,
                        toolsRepaired: agentResult.toolsRepaired,
                    });
                    // Never surface tool pseudo-code the model wrote instead of calling tools.
                    const safeContent = stripToolCallSyntax(agentResult.content).trim();
                    if (safeContent) {
                        await emitSimulatedStreaming(
                            { content: safeContent, reasoning: agentResult.reasoning },
                            onChunk
                        );
                        onComplete(safeContent, agentResult.reasoning);
                        return;
                    }
                    // Tools ran but the model never produced user-facing prose. Avoid a cold
                    // stream fallback that re-dumps the same function-call syntax into the UI.
                    if (agentResult.usedTools) {
                        const fallback =
                            "I looked through what is on this device, but I am having trouble putting the answer into words. Try asking once more, or rephrase slightly.";
                        await emitSimulatedStreaming(
                            { content: fallback, reasoning: agentResult.reasoning },
                            onChunk
                        );
                        onComplete(fallback, agentResult.reasoning);
                        return;
                    }
                } catch (error) {
                    if (error instanceof ToolsUnsupportedError) {
                        markToolsUnsupported(activeModelId);
                        logToolTelemetry('tools_unsupported', { model: activeModelId });
                    } else {
                        console.warn('History agent loop failed, falling back to stream:', error);
                    }
                    // Fix 3: remove tools policy so the stream model does not emit tool syntax.
                    systemPrompt = systemPrompt.replace(HISTORY_TOOLS_POLICY, '').trim();
                }
            } else {
                logToolTelemetry('stream_inject_only', { model: activeModelId, mode: capability.mode });
            }
        }

        // Stream path: log [prompt-budget] after stream so real usage can attach.
        // PR8c: never bare n/a — usage-unavailable when provider omits usage.
        const logStreamBudget = (usage: { prompt_tokens?: number } | null) => {
            if (lastUsage) return; // already logged on agent path
            const streamLedger = attachRealUsage(
                buildLedgerFromAssembledRequest({
                    systemPrompt,
                    messages: outboundMessages,
                    toolsBranch,
                    includeToolsSchema: false,
                    eagerAugmentationText,
                }),
                usage
            );
            logPromptBudget(streamLedger);
        };

        const streamPayload = buildChatPayload(
            DEFAULT_DIRECT_MODEL,
            outboundMessages,
            systemPrompt,
            true,
            resolved.conversationId,
            resolved.generation
        );

        // Fix 3: strip any residual tool syntax from the final streamed content.
        const safeOnComplete: CompleteCallback = (content, reasoning) => {
            const stripped = stripToolCallSyntax(content).trim();
            onComplete(stripped || content, reasoning);
        };

        const xhrResult = await streamChatWithXhr(
            streamPayload, onChunk, safeOnComplete
        ).catch((error) => {
            console.warn('XMLHttpRequest streaming fallback failed:', error);
            return { ok: false as const, usage: null };
        });
        if (xhrResult.ok) {
            logStreamBudget(xhrResult.usage);
            return;
        }

        const response = await fetchChatCompletion(streamPayload);
        const streamingAvailable = hasReadableStream(response.body)
            && (response.headers.get('content-type') || '').includes('text/event-stream');
        if (!response.ok) {
            throw await buildResponseError(response, 'AI request failed', streamingAvailable);
        }
        if (streamingAvailable && response.body) {
            const streamUsage = await readStreamResponse(response.body, onChunk, safeOnComplete);
            logStreamBudget(streamUsage);
            return;
        }
        const fallbackResult = await readNonStreamingResponse(response);
        logStreamBudget(fallbackResult.usage ?? null);
        await emitSimulatedStreaming(fallbackResult, onChunk);
        safeOnComplete(fallbackResult.content, fallbackResult.reasoning);
    } catch (error) {
        onError(normalizeUnknownError(error));
    }
}

export async function completeChat(
    messages: Message[],
    systemPrompt: string,
    options?: { conversationId?: string; generation?: StreamChatOptions['generation'] }
): Promise<ChatAccumulator> {
    const contextWindow = await resolveContextWindow();
    const compactResult = compactConversationIfNeeded(messages, {
        systemPrompt,
        contextWindow,
    });
    const payload = buildChatPayload(
        DEFAULT_DIRECT_MODEL,
        compactResult.messages,
        systemPrompt,
        false,
        options?.conversationId,
        options?.generation
    );
    const response = await fetchChatCompletion(payload);
    if (!response.ok) {
        throw await buildResponseError(response, 'AI request failed', false);
    }
    return readNonStreamingResponse(response);
}
