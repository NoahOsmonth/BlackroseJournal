/* eslint-disable import/first */
/**
 * Embeddings transport must NOT use chat freeOnly / assertModelAllowed.
 * What would make this fail: importing assertModelAllowed or routing via chat completions.
 */

jest.mock('../../../services/ai/directConfig', () => ({
    getResolvedDirectConfig: jest.fn(async () => ({
        apiKey: 'test-key',
        apiBaseUrl: 'https://openrouter.ai/api/v1',
        model: 'tencent/hy3:free',
        flashModel: 'tencent/hy3:free',
        source: 'env' as const,
    })),
}));

jest.mock('../../../services/ai/providerCapabilities', () => ({
    getProviderCapabilities: jest.fn(() => ({
        extraHeaders: { 'X-Title': 'test' },
        supportsResponseFormat: true,
        maxTokensField: 'max_tokens' as const,
        retryableStatuses: new Set([429, 500]),
    })),
}));

import { EMBEDDING_MODEL } from '../../../services/memory/embeddings';
import { embedText, embedTexts } from '../../../services/ai/embeddingsTransport';

describe('embeddingsTransport', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    it('POSTs /embeddings with locked model (not chat completions)', async () => {
        const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
            expect(String(url)).toContain('/embeddings');
            expect(String(url)).not.toContain('/chat/completions');
            const body = JSON.parse(String(init?.body ?? '{}'));
            expect(body.model).toBe(EMBEDDING_MODEL);
            expect(body.input).toBe('hello journal');
            return {
                ok: true,
                json: async () => ({
                    data: [{ index: 0, embedding: [3, 4] }],
                }),
            } as Response;
        });
        global.fetch = fetchMock as unknown as typeof fetch;

        const vec = await embedText('hello journal');
        // L2-normalized [3,4] → [0.6, 0.8]
        expect(vec?.[0]).toBeCloseTo(0.6, 5);
        expect(vec?.[1]).toBeCloseTo(0.8, 5);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('returns null when the provider errors (offline soft-fail)', async () => {
        global.fetch = jest.fn(async () => ({
            ok: false,
            status: 503,
            text: async () => 'busy',
        })) as unknown as typeof fetch;

        await expect(embedTexts(['a', 'b'])).resolves.toBeNull();
    });

    it('does not import chat freeOnly guards', () => {
        // Static source guard — embeddings path must stay separate.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require('fs') as typeof import('fs');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const path = require('path') as typeof import('path');
        const src = fs.readFileSync(
            path.join(process.cwd(), 'services/ai/embeddingsTransport.ts'),
            'utf8',
        );
        // Strip block comments so "do NOT use assertModelAllowed" docs don't false-positive.
        const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        expect(codeOnly).not.toMatch(/assertModelAllowed/);
        expect(codeOnly).not.toMatch(/freeOnly/);
        expect(codeOnly).not.toMatch(/fetchDirectChatCompletion/);
        expect(codeOnly).not.toMatch(/from ['"].*customModels['"]/);
        expect(src).toMatch(/\/embeddings/);
    });
});
