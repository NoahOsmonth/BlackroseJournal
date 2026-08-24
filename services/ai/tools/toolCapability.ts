/**
 * Tool-capability routing for free vs tool-capable models.
 *
 * 2026 practice: only run the tools API agent loop when the model can
 * usefully participate. Weak / unknown free models still get digests + clock
 * inject; hybrid models get structured tools + text-dump fallback.
 */

export type ToolCapabilityMode =
    /** Send tools; prefer structured tool_calls; text dump as last resort. */
    | 'structured'
    /** Send tools; expect frequent text dumps; dual-path parse + text result feed. */
    | 'hybrid'
    /** Do not run agent loop / tools API — rely on prompt inject only. */
    | 'inject_only';

export interface ToolCapability {
    mode: ToolCapabilityMode;
    /** Include `tools` + `tool_choice` on the completion request. */
    sendToolsInApi: boolean;
    /** Run multi-round agent loop. */
    runAgentLoop: boolean;
    /**
     * Feed tool results as a plain user block (free models often ignore `role: tool`).
     * Structured OpenAI tool messages are still used when origin is structured and
     * this is false.
     */
    preferTextResultProtocol: boolean;
    /** Parse free-text tool dumps from assistant content. */
    parseTextToolDumps: boolean;
}

/** Session/process memory of providers that rejected tools for a model id. */
const toolsUnsupportedModels = new Set<string>();

function normalizeModelId(modelId: string | undefined | null): string {
    return (modelId ?? '').trim().toLowerCase();
}

/**
 * Models known to emit reliable structured tool_calls (OpenAI-compatible).
 * Heuristic list — unknown free models fall through to hybrid.
 */
const STRUCTURED_RE =
    /\b(gpt-4|gpt-4o|gpt-5|o1|o3|o4|claude|gemini|command-r|deepseek-chat|deepseek-v3|qwen3|qwen2\.5|qwq|kimi-k2|llama-4|mistral-large|mistral-medium)\b/i;

/** Models that frequently dump tool syntax as text even when tools are accepted. */
const HYBRID_RE =
    /\b(hy3|nemotron|hermes|tool[-_]?use|:free|free\/)\b/i;

/** Models that should skip the tools API entirely (known non-support or pure chat). */
const INJECT_ONLY_RE =
    /\b(tinyllama|phi-2|gemma-2b|smollm)\b/i;

export function markToolsUnsupported(modelId: string): void {
    const id = normalizeModelId(modelId);
    if (id) toolsUnsupportedModels.add(id);
}

export function clearToolsUnsupportedCache(): void {
    toolsUnsupportedModels.clear();
}

export function isMarkedToolsUnsupported(modelId: string): boolean {
    return toolsUnsupportedModels.has(normalizeModelId(modelId));
}

export function resolveToolCapability(modelId: string | undefined | null): ToolCapability {
    const id = normalizeModelId(modelId);

    if (!id || id === 'agent-default') {
        // Resolved model unknown until transport — assume hybrid (safe for free OpenRouter).
        return hybridCapability();
    }

    if (toolsUnsupportedModels.has(id)) {
        return injectOnlyCapability();
    }

    if (INJECT_ONLY_RE.test(id)) {
        return injectOnlyCapability();
    }

    // Explicit free / dump-prone models → hybrid even if name matches something else.
    if (id.includes(':free') || HYBRID_RE.test(id)) {
        return hybridCapability();
    }

    if (STRUCTURED_RE.test(id)) {
        return structuredCapability();
    }

    // Unknown paid / custom → hybrid (tools on + text safety net).
    return hybridCapability();
}

export function resolveManagedToolCapability(
    modelId: string | undefined | null,
    supportsTools: boolean
): ToolCapability {
    return supportsTools ? resolveToolCapability(modelId) : injectOnlyCapability();
}

function structuredCapability(): ToolCapability {
    return {
        mode: 'structured',
        sendToolsInApi: true,
        runAgentLoop: true,
        preferTextResultProtocol: false,
        parseTextToolDumps: true,
    };
}

function hybridCapability(): ToolCapability {
    return {
        mode: 'hybrid',
        sendToolsInApi: true,
        runAgentLoop: true,
        preferTextResultProtocol: true,
        parseTextToolDumps: true,
    };
}

function injectOnlyCapability(): ToolCapability {
    return {
        mode: 'inject_only',
        sendToolsInApi: false,
        runAgentLoop: false,
        preferTextResultProtocol: false,
        parseTextToolDumps: false,
    };
}

/** Lightweight debug telemetry (no PII). */
export function logToolTelemetry(event: string, data: Record<string, unknown>): void {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
        // eslint-disable-next-line no-console
        console.debug(`[tools] ${event}`, data);
    }
}
