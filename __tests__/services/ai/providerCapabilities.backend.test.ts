/**
 * Tests for backend/src/services/ai/providerCapabilities.ts.
 *
 * Mirrors the frontend capability table: ZenMux must use
 * `max_completion_tokens`, default hosts use `max_tokens`. Runs under the
 * root Jest config (backend source is imported directly), matching the
 * existing openaiCompat.test.ts layout.
 */
import {
    getProviderRequestCapabilities,
    resolveProviderHost,
} from '../../../backend/src/services/ai/providerCapabilities';

describe('providerCapabilities (backend)', () => {
    it('parses the hostname from a base URL', () => {
        expect(resolveProviderHost('https://zenmux.ai/api/v1')).toBe('zenmux.ai');
    });

    it('defaults to max_tokens and retries transient gateway statuses including 500/504', () => {
        const caps = getProviderRequestCapabilities('https://nano-gpt.com/api/v1');
        expect(caps.maxTokensField).toBe('max_tokens');
        expect(caps.retryableStatuses.has(429)).toBe(true);
        expect(caps.retryableStatuses.has(500)).toBe(true);
        expect(caps.retryableStatuses.has(503)).toBe(true);
        expect(caps.retryableStatuses.has(504)).toBe(true);
    });

    it('maps ZenMux to max_completion_tokens and treats gateway errors as retryable', () => {
        const caps = getProviderRequestCapabilities('https://zenmux.ai/api/v1');
        expect(caps.maxTokensField).toBe('max_completion_tokens');
        expect(caps.retryableStatuses.has(500)).toBe(true);
        expect(caps.retryableStatuses.has(504)).toBe(true);
    });
});

