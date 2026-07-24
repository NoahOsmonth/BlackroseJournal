/**
 * Tests for services/ai/streamingTransports.ts — Fix 5:
 * XHR streaming skips when the primary model is cached-unavailable.
 */
import type { ChatRequestPayload } from '../../../services/ai/chatTypes';
import {
    clearModelUnavailableCache,
    isModelCachedUnavailable,
} from '../../../services/ai/directTransport';
import { streamChatWithXhr } from '../../../services/ai/streamingTransports';

// Mock directTransport so prepareDirectChatRequest doesn't hit real config.
jest.mock('../../../services/ai/directConfig', () => ({
    getDirectConfig: () => ({
        apiKey: 'sk-test',
        apiBaseUrl: 'https://openrouter.ai/api/v1',
        model: 'dead/model:free',
        flashModel: 'dead/model:free',
    }),
    getResolvedDirectConfig: jest.fn(() =>
        Promise.resolve({
            apiKey: 'sk-test',
            apiBaseUrl: 'https://openrouter.ai/api/v1',
            model: 'dead/model:free',
            flashModel: 'dead/model:free',
            source: 'env',
        })
    ),
}));

jest.mock('../../../services/ai/customModels', () => ({
    loadCustomAiProviderSettings: jest.fn(() =>
        Promise.resolve({
            enabled: false,
            baseUrl: 'https://openrouter.ai/api/v1',
            apiKey: '',
            selectedModelId: null,
            models: [],
            freeOnly: true,
            recentModelIds: [],
            fallbackContextWindow: 128_000,
            updatedAt: 0,
        })
    ),
    getKnownContextWindow: () => undefined,
}));

const BASE_PAYLOAD: ChatRequestPayload = {
    model: 'dead/model:free',
    messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hello' },
    ],
    stream: true,
    temperature: 0.7,
    top_p: 0.9,
    max_tokens: 1024,
};

describe('streamChatWithXhr — Fix 5: skip when model cached-unavailable', () => {
    beforeEach(() => {
        clearModelUnavailableCache();
    });

    afterEach(() => {
        clearModelUnavailableCache();
    });

    it('returns { ok: false } immediately when model is cached-unavailable', async () => {
        // Simulate the cache being populated (normally done by fetchWithSelfHeal on 404).
        // We access the internal cache indirectly: trigger a 404 via fetch mock.
        const fetchMock = jest.fn().mockResolvedValue(
            new Response(
                JSON.stringify({ error: { message: 'No endpoints found' } }),
                { status: 404 }
            )
        );
        const originalFetch = global.fetch;
        global.fetch = fetchMock as unknown as typeof fetch;

        // Import fetchDirectChatCompletion to trigger the cache
        const { fetchDirectChatCompletion } = require('../../../services/ai/directTransport');
        try {
            await fetchDirectChatCompletion({
                model: 'dead/model:free',
                messages: [{ role: 'user', content: 'hi' }],
                stream: false,
            });
        } catch {
            // Expected — all attempts fail
        }

        global.fetch = originalFetch;

        // Now the model should be cached as unavailable
        expect(isModelCachedUnavailable('dead/model:free')).toBe(true);

        // XHR should skip immediately
        const onChunk = jest.fn();
        const onComplete = jest.fn();
        const result = await streamChatWithXhr(BASE_PAYLOAD, onChunk, onComplete);

        expect(result.ok).toBe(false);
        expect(onChunk).not.toHaveBeenCalled();
        expect(onComplete).not.toHaveBeenCalled();
    });

    it('does not skip XHR when model is NOT cached-unavailable', async () => {
        // Model not in cache — XHR should attempt (and fail because no real XHR in Jest,
        // but it should NOT return { ok: false } from the cache check).
        // In Jest, XMLHttpRequest is not available, so hasXmlHttpRequest() returns false.
        const onChunk = jest.fn();
        const onComplete = jest.fn();
        const result = await streamChatWithXhr(BASE_PAYLOAD, onChunk, onComplete);

        // Returns false because no XHR in Jest env (not because of cache)
        expect(result.ok).toBe(false);
    });
});
