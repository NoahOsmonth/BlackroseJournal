/**
 * Provider capability detection for the direct (phone-side) AI transport.
 *
 * OpenAI-compatible gateways disagree on which request fields they accept.
 * Most follow the OpenAI schema (`max_tokens`); ZenMux explicitly rejects
 * `max_tokens` and wants `max_completion_tokens`. Centralising these
 * differences here keeps `directTransport.ts` free of per-host branching and
 * turns "add a provider" into a one-line table entry.
 *
 * There are two independent axes, and both are needed:
 * - **Host** (`zenmux.ai`): the gateway's own quirks, keyed off the base URL.
 * - **Kind** (Google AI Studio / Anthropic compatibility layers): the upstream
 *   vendor's dialect, chosen by the user when the provider is added. These are
 *   not host-detectable — the same host can front any upstream, and a user may
 *   point a Google profile at their own proxy.
 */
import type { ProviderKind } from './customModels';

export type MaxTokensField = 'max_tokens' | 'max_completion_tokens';

export interface ProviderCapabilities {
    /** Wire field used to cap generated token count. */
    maxTokensField: MaxTokensField;
    /** Whether `response_format` (json_object) is accepted. */
    supportsResponseFormat: boolean;
    /** HTTP statuses worth retrying (transient outages / rate limits). */
    retryableStatuses: ReadonlySet<number>;
    /** Extra headers some gateways require (e.g. a routing hint). */
    extraHeaders: Readonly<Record<string, string>>;
    /**
     * True when `temperature` / `top_p` must not be sent at all. Anthropic's
     * compatibility layer accepts only exactly 1 for `temperature` on current
     * Claude models (below 1 is a 400, above 1 is capped) and rejects a request
     * that sets both `temperature` and `top_p`, so the only shape that works on
     * every Claude model is to omit both and take the endpoint defaults.
     */
    omitSamplingFields: boolean;
    /**
     * True when `tool_choice` must stay `auto`. Anthropic's compatibility layer
     * rejects forced tool use on several current Claude models.
     */
    forceToolChoiceUnsupported: boolean;
}

/** Transient gateway / rate-limit statuses worth auto-retrying (3×). */
const TRANSIENT_HTTP_STATUSES = [429, 500, 502, 503, 504] as const;

const DEFAULT_CAPABILITIES: ProviderCapabilities = {
    maxTokensField: 'max_tokens',
    supportsResponseFormat: true,
    retryableStatuses: new Set(TRANSIENT_HTTP_STATUSES),
    extraHeaders: {},
    omitSamplingFields: false,
    forceToolChoiceUnsupported: false,
};

/**
 * Per-host overrides. Keyed by the hostname parsed from the configured base
 * URL, so whichever endpoint the user points the app at
 * (`EXPO_PUBLIC_AI_CUSTOM_BASE` or a saved provider profile) selects the right
 * behaviour automatically.
 */
const HOST_OVERRIDES: Record<string, Partial<ProviderCapabilities>> = {
    'zenmux.ai': {
        maxTokensField: 'max_completion_tokens',
        retryableStatuses: new Set(TRANSIENT_HTTP_STATUSES),
    },
    // No identity headers are pinned anywhere: the app targets plain OpenAI
    // defaults, and any extra header a gateway needs is declared per host here.
};

/**
 * Per-kind overrides for the vendor compatibility layers, from their own docs:
 *
 * Google — Gemini's `/v1beta/openai/` layer ignores request fields it does not
 * know, so the OpenAI defaults are safe and `response_format` can be offered:
 * either the endpoint honours it or it ignores it and the JSON helper parses
 * the prose answer as before.
 *
 * Anthropic — `/v1/` compatibility layer: `temperature` above 1 is capped (and
 * current models 400 below 1), `temperature` + `top_p` together is a 400, and
 * `response_format` accepts only `json_schema` with `strict: true`, so a
 * `json_object` request is a guaranteed 400. Omit it instead of spending a
 * round trip on the rejection.
 */
const KIND_OVERRIDES: Record<ProviderKind, Partial<ProviderCapabilities>> = {
    openai: {},
    google: {},
    anthropic: {
        supportsResponseFormat: false,
        omitSamplingFields: true,
        forceToolChoiceUnsupported: true,
    },
};

export function resolveProviderHost(apiBaseUrl: string): string | null {
    try {
        const url = new URL(apiBaseUrl);
        return url.hostname.toLowerCase() || null;
    } catch {
        return null;
    }
}

export function getProviderCapabilities(
    apiBaseUrl: string,
    kind: ProviderKind = 'openai',
): ProviderCapabilities {
    const host = resolveProviderHost(apiBaseUrl);
    const hostOverrides = host ? HOST_OVERRIDES[host] : undefined;
    const overrides = { ...KIND_OVERRIDES[kind], ...hostOverrides };
    return {
        ...DEFAULT_CAPABILITIES,
        ...overrides,
        retryableStatuses: new Set(
            overrides.retryableStatuses ?? DEFAULT_CAPABILITIES.retryableStatuses
        ),
        extraHeaders: { ...(overrides.extraHeaders ?? {}) },
    };
}
