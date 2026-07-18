/**
 * PR3+ — host-based request capabilities for the openai-compat adapter.
 *
 * OpenAI-compatible gateways disagree on which request fields they accept.
 * NanoGPT follows the OpenAI schema (`max_tokens`); ZenMux explicitly rejects
 * `max_tokens` and wants `max_completion_tokens`. Keeping this table separate
 * from the SSE `Capabilities` descriptor (which describes the *response* wire
 * format) avoids conflating request-shape with response-shape concerns.
 */
export type MaxTokensField = 'max_tokens' | 'max_completion_tokens';

export interface ProviderRequestCapabilities {
    maxTokensField: MaxTokensField;
    retryableStatuses: ReadonlySet<number>;
}

/** Transient gateway / rate-limit statuses worth auto-retrying (3×). */
const TRANSIENT_HTTP_STATUSES = [429, 500, 502, 503, 504] as const;

const DEFAULT_CAPABILITIES: ProviderRequestCapabilities = {
    maxTokensField: 'max_tokens',
    retryableStatuses: new Set(TRANSIENT_HTTP_STATUSES),
};

const HOST_OVERRIDES: Record<string, Partial<ProviderRequestCapabilities>> = {
    'zenmux.ai': {
        maxTokensField: 'max_completion_tokens',
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

export function getProviderRequestCapabilities(apiBaseUrl: string): ProviderRequestCapabilities {
    const host = resolveProviderHost(apiBaseUrl);
    const overrides = host ? HOST_OVERRIDES[host] : undefined;
    if (!overrides) {
        return {
            maxTokensField: DEFAULT_CAPABILITIES.maxTokensField,
            retryableStatuses: new Set(DEFAULT_CAPABILITIES.retryableStatuses),
        };
    }
    return {
        maxTokensField: overrides.maxTokensField ?? DEFAULT_CAPABILITIES.maxTokensField,
        retryableStatuses: new Set(overrides.retryableStatuses ?? DEFAULT_CAPABILITIES.retryableStatuses),
    };
}
