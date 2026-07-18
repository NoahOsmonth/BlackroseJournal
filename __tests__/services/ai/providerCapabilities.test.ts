/**
 * Tests for services/ai/providerCapabilities.ts.
 *
 * Verifies host-based capability resolution and the one known override
 * (ZenMux's `max_completion_tokens` requirement + 500 retryability).
 */
import {
    getProviderCapabilities,
    resolveProviderHost,
} from '../../../services/ai/providerCapabilities';

describe('providerCapabilities — resolveProviderHost', () => {
    it('parses the hostname from a base URL', () => {
        expect(resolveProviderHost('https://zenmux.ai/api/v1')).toBe('zenmux.ai');
        expect(resolveProviderHost('https://nano-gpt.com/api/v1')).toBe('nano-gpt.com');
    });

    it('returns null for an unparseable URL', () => {
        expect(resolveProviderHost('not-a-url')).toBeNull();
    });
});

describe('providerCapabilities — getProviderCapabilities', () => {
    it('defaults to OpenAI schema (max_tokens) with transient gateway retries for unknown hosts', () => {
        const caps = getProviderCapabilities('https://example.com/api/v1');
        expect(caps.maxTokensField).toBe('max_tokens');
        expect(caps.supportsResponseFormat).toBe(true);
        expect(caps.retryableStatuses.has(429)).toBe(true);
        expect(caps.retryableStatuses.has(500)).toBe(true);
        expect(caps.retryableStatuses.has(502)).toBe(true);
        expect(caps.retryableStatuses.has(503)).toBe(true);
        expect(caps.retryableStatuses.has(504)).toBe(true);
        expect(caps.extraHeaders).toEqual({});
    });

    it('maps OpenRouter to app identity headers and transient gateway retries', () => {
        const caps = getProviderCapabilities('https://openrouter.ai/api/v1');
        expect(caps.maxTokensField).toBe('max_tokens');
        expect(caps.extraHeaders['HTTP-Referer']).toBeTruthy();
        expect(caps.extraHeaders['X-Title']).toBe('Blackrose Journal');
        expect(caps.retryableStatuses.has(429)).toBe(true);
        expect(caps.retryableStatuses.has(502)).toBe(true);
        expect(caps.retryableStatuses.has(503)).toBe(true);
        expect(caps.retryableStatuses.has(504)).toBe(true);
    });

    it('maps NanoGPT to the OpenAI schema', () => {
        const caps = getProviderCapabilities('https://nano-gpt.com/api/v1');
        expect(caps.maxTokensField).toBe('max_tokens');
    });

    it('maps ZenMux to max_completion_tokens and treats gateway errors as retryable', () => {
        const caps = getProviderCapabilities('https://zenmux.ai/api/v1');
        expect(caps.maxTokensField).toBe('max_completion_tokens');
        expect(caps.retryableStatuses.has(500)).toBe(true);
        expect(caps.retryableStatuses.has(429)).toBe(true);
        expect(caps.retryableStatuses.has(503)).toBe(true);
        expect(caps.retryableStatuses.has(504)).toBe(true);
    });

    it('is case/port insensitive on the host and never mutates shared sets', () => {
        const a = getProviderCapabilities('https://ZENMUX.ai:443/api/v1');
        const b = getProviderCapabilities('https://zenmux.ai/api/v1');
        expect(a.maxTokensField).toBe('max_completion_tokens');
        expect(a.retryableStatuses).not.toBe(b.retryableStatuses);
    });
});
