/**
 * Provider capability detection for the direct (phone-side) AI transport.
 *
 * OpenAI-compatible gateways disagree on which request fields they accept.
 * NanoGPT follows the OpenAI schema (`max_tokens`); ZenMux explicitly rejects
 * `max_tokens` and wants `max_completion_tokens`. Centralising these
 * differences here keeps `directTransport.ts` free of per-host branching and
 * turns "add a provider" into a one-line table entry.
 */
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
}

/** Transient gateway / rate-limit statuses worth auto-retrying (3×). */
const TRANSIENT_HTTP_STATUSES = [429, 500, 502, 503, 504] as const;

const DEFAULT_CAPABILITIES: ProviderCapabilities = {
    maxTokensField: 'max_tokens',
    supportsResponseFormat: true,
    retryableStatuses: new Set(TRANSIENT_HTTP_STATUSES),
    extraHeaders: {},
};

/**
 * Per-host overrides. Keyed by the hostname parsed from the configured base
 * URL so a single env var (`EXPO_PUBLIC_NANO_GPT_API_BASE_URL`) or a custom
 * provider base URL selects the right behaviour automatically.
 */
const HOST_OVERRIDES: Record<string, Partial<ProviderCapabilities>> = {
    'zenmux.ai': {
        maxTokensField: 'max_completion_tokens',
        retryableStatuses: new Set(TRANSIENT_HTTP_STATUSES),
    },
    'openrouter.ai': {
        // OpenRouter recommends identifying the app for free-tier routing.
        extraHeaders: {
            'HTTP-Referer': 'https://blackrosejournal.app',
            'X-Title': 'Blackrose Journal',
        },
        retryableStatuses: new Set(TRANSIENT_HTTP_STATUSES),
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

export function getProviderCapabilities(apiBaseUrl: string): ProviderCapabilities {
    const host = resolveProviderHost(apiBaseUrl);
    const overrides = host ? HOST_OVERRIDES[host] : undefined;
    if (!overrides) {
        return {
            ...DEFAULT_CAPABILITIES,
            retryableStatuses: new Set(DEFAULT_CAPABILITIES.retryableStatuses),
            extraHeaders: {},
        };
    }
    return {
        ...DEFAULT_CAPABILITIES,
        ...overrides,
        retryableStatuses: new Set(overrides.retryableStatuses ?? DEFAULT_CAPABILITIES.retryableStatuses),
        extraHeaders: { ...(overrides.extraHeaders ?? {}) },
    };
}
