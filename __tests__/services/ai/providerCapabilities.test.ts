/**
 * Tests for services/ai/providerCapabilities.ts.
 *
 * Verifies host-based capability resolution, the one known host override
 * (ZenMux's `max_completion_tokens` requirement + 500 retryability), and the
 * per-kind dialect differences that decide what the transport may send.
 */
import {
    getProviderCapabilities,
    resolveProviderHost,
} from '../../../services/ai/providerCapabilities';

describe('providerCapabilities — resolveProviderHost', () => {
    it('parses the hostname from a base URL', () => {
        expect(resolveProviderHost('https://zenmux.ai/api/v1')).toBe('zenmux.ai');
        expect(resolveProviderHost('https://api.example.com/v1')).toBe('api.example.com');
        expect(resolveProviderHost('http://192.0.2.10:8080/v1')).toBe('192.0.2.10');
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

    it('defaults unknown hosts (including a bare-IP gateway) to plain OpenAI behavior', () => {
        const caps = getProviderCapabilities('http://192.0.2.10:8080/v1');
        expect(caps.maxTokensField).toBe('max_tokens');
        expect(caps.extraHeaders).toEqual({});
        expect(caps.retryableStatuses.has(429)).toBe(true);
    });

    it('maps an unknown named host to the OpenAI schema', () => {
        const caps = getProviderCapabilities('https://api.example.com/v1');
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

    it('treats a missing kind as plain OpenAI', () => {
        const caps = getProviderCapabilities('https://example.com/api/v1');
        expect(caps.supportsResponseFormat).toBe(true);
        expect(caps.omitSamplingFields).toBe(false);
    });

    it('keeps Google on the OpenAI request shape', () => {
        // Gemini's compatibility layer ignores fields it does not know, so the
        // app sends the normal schema and lets the endpoint drop what it cannot
        // use. Nothing may be omitted on this kind's behalf.
        const caps = getProviderCapabilities(
            'https://generativelanguage.googleapis.com/v1beta/openai',
            'google',
        );
        expect(caps.maxTokensField).toBe('max_tokens');
        expect(caps.supportsResponseFormat).toBe(true);
        expect(caps.omitSamplingFields).toBe(false);
    });

    it('suppresses the fields Anthropic\'s compatibility layer rejects', () => {
        // Both are documented 400s: `response_format: json_object` (only
        // json_schema is accepted), and a request that sets both temperature and
        // top_p. `tool_choice` is NOT suppressed here — the agent loop owns that
        // retry, and downgrading it in the transport would pre-empt it.
        const caps = getProviderCapabilities('https://api.anthropic.com/v1', 'anthropic');
        expect(caps.supportsResponseFormat).toBe(false);
        expect(caps.omitSamplingFields).toBe(true);
        // Anthropic still accepts the OpenAI token field.
        expect(caps.maxTokensField).toBe('max_tokens');
    });

    it('applies kind and host overrides independently', () => {
        // A gateway host keeps its own quirk while the user-chosen dialect
        // decides sampling fields — the two axes must not overwrite each other.
        const caps = getProviderCapabilities('https://zenmux.ai/api/v1', 'anthropic');
        expect(caps.maxTokensField).toBe('max_completion_tokens');
        expect(caps.omitSamplingFields).toBe(true);
    });
});
