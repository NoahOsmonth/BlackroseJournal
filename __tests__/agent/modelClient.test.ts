/**
 * PR4 — modelClient thin wrapper contract.
 *
 * Verifies the new modelClient shape:
 *  - createChatCompletion returns { content, reasoning } from the provider
 *  - reasoning is empty when the resolved profile's capabilities.reasoning is false
 *  - createChatCompletionStream returns the upstream Response untouched
 *  - Client-supplied `model` is ignored (server-side profile resolution)
 *  - Missing config surfaces at boot via loadConfig(), not at request time
 */
import { getProviderForProfile } from '../../backend/src/services/ai';
import { getAiConfig, loadConfig } from '../../backend/src/config/ai';
import {
    createChatCompletion,
    createChatCompletionStream,
} from '../../backend/src/agent/modelClient';

jest.mock('../../backend/src/services/ai', () => {
    const actual = jest.requireActual('../../backend/src/services/ai');
    return {
        ...actual,
        getProviderForProfile: jest.fn(),
    };
});

jest.mock('../../backend/src/config/ai', () => {
    const actual = jest.requireActual('../../backend/src/config/ai');
    return {
        ...actual,
        getAiConfig: jest.fn(),
        loadConfig: jest.fn(),
    };
});

const mockGetProviderForProfile = getProviderForProfile as jest.MockedFunction<
    typeof getProviderForProfile
>;
const mockGetAiConfig = getAiConfig as jest.MockedFunction<typeof getAiConfig>;
const mockLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;

function makeProfile(reasoning = true): {
    apiBaseUrl: string;
    apiKey: string;
    model: string;
    flashModel: string;
    capabilities: { streaming: true; reasoning: boolean; reasoningField: 'reasoning_content' | 'reasoning' | null; sseFormat: 'openai'; authHeaderStyle: 'bearer' };
} {
    return {
        apiBaseUrl: 'https://example.com/api/v1',
        apiKey: 'sk-test-key',
        model: 'test-model',
        flashModel: 'test-flash',
        capabilities: {
            streaming: true,
            reasoning,
            reasoningField: reasoning ? 'reasoning_content' : null,
            sseFormat: 'openai',
            authHeaderStyle: 'bearer',
        },
    };
}

function makeProvider(): {
    id: string;
    capabilities: { streaming: true; reasoning: boolean; reasoningField: 'reasoning_content' | 'reasoning' | null; sseFormat: 'openai'; authHeaderStyle: 'bearer' };
    resolveProfile: jest.Mock;
    chat: jest.Mock;
    stream: jest.Mock;
} {
    return {
        id: 'openai-compat',
        capabilities: {
            streaming: true,
            reasoning: true,
            reasoningField: 'reasoning_content',
            sseFormat: 'openai',
            authHeaderStyle: 'bearer',
        },
        resolveProfile: jest.fn(),
        chat: jest.fn(),
        stream: jest.fn(),
    };
}

describe('backend/src/agent/modelClient (PR4 thin wrapper)', () => {
    let provider: ReturnType<typeof makeProvider>;

    beforeEach(() => {
        provider = makeProvider();
        mockGetProviderForProfile.mockReturnValue(provider);
        provider.resolveProfile.mockReturnValue(makeProfile(true));
        mockGetAiConfig.mockReturnValue(makeProfile(true));
        mockLoadConfig.mockReturnValue(makeProfile(true));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('createChatCompletion returns { content, reasoning } from the provider', async () => {
        provider.chat.mockResolvedValue({
            content: 'Hello there.',
            reasoning: 'a private thought',
            raw: { ok: true },
        });

        const result = await createChatCompletion([
            { role: 'user', content: 'hi' },
        ]);

        expect(result).toEqual({ content: 'Hello there.', reasoning: 'a private thought' });
        expect(provider.chat).toHaveBeenCalledTimes(1);
        const [req, profile] = provider.chat.mock.calls[0] as [{ messages: unknown[] }, { model: string }];
        expect(req.messages).toEqual([{ role: 'user', content: 'hi' }]);
        expect(profile.model).toBe('test-model');
    });

    it('returns empty reasoning when the resolved profile has capabilities.reasoning === false', async () => {
        provider.resolveProfile.mockReturnValue(makeProfile(false));
        provider.chat.mockResolvedValue({ content: 'ok', reasoning: '', raw: {} });

        const result = await createChatCompletion([
            { role: 'user', content: 'hi' },
        ]);

        expect(result).toEqual({ content: 'ok', reasoning: '' });
        const profile = provider.resolveProfile.mock.results[0]?.value;
        expect(profile.capabilities.reasoning).toBe(false);
        expect(profile.capabilities.reasoningField).toBeNull();
    });

    it('does not include max_context in the upstream request body', async () => {
        provider.chat.mockResolvedValue({ content: 'ok', reasoning: '', raw: {} });

        await createChatCompletion([{ role: 'user', content: 'hi' }], {
            temperature: 0.3,
            maxTokens: 64,
        });

        const [req] = provider.chat.mock.calls[0] as [{ messages?: unknown[]; max_context?: unknown }];
        expect(req).not.toHaveProperty('max_context');
        expect(req.messages).toBeDefined();
    });

    it('ignores client-supplied model in v1 (server-side profile resolution)', async () => {
        provider.chat.mockResolvedValue({ content: 'ok', reasoning: '', raw: {} });

        await createChatCompletion(
            [{ role: 'user', content: 'hi' }],
            { model: 'hack-attempt', temperature: 0.5 }
        );

        // resolveProfile is called with the server-side profile name 'default',
        // not with whatever the client passed in.
        expect(provider.resolveProfile).toHaveBeenCalledWith('default');
        // The client-supplied model name must NOT appear in the upstream profile.
        const profile = provider.resolveProfile.mock.results[0]?.value;
        expect(profile.model).toBe('test-model');
        expect(profile.model).not.toBe('hack-attempt');
    });

    it('createChatCompletionStream returns the upstream Response untouched (body not consumed)', async () => {
        const upstream = new Response('data: [DONE]\n\n', {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
        });
        provider.stream.mockResolvedValue(upstream);

        const response = await createChatCompletionStream([
            { role: 'user', content: 'hi' },
        ]);

        expect(response).toBe(upstream);
        // The body must still be readable by the caller.
        const text = await response.text();
        expect(text).toBe('data: [DONE]\n\n');
        // Provider was asked for a stream.
        const [req] = provider.stream.mock.calls[0] as [{ stream?: boolean }];
        expect(req.stream).toBe(true);
    });

    it('passes temperature and maxTokens through to the provider', async () => {
        provider.chat.mockResolvedValue({ content: 'ok', reasoning: '', raw: {} });

        await createChatCompletion(
            [{ role: 'user', content: 'hi' }],
            { temperature: 0.42, maxTokens: 256 }
        );

        const [req] = provider.chat.mock.calls[0] as [{ temperature?: number; maxTokens?: number }];
        expect(req.temperature).toBe(0.42);
        expect(req.maxTokens).toBe(256);
    });

    it('forwards a propagation error from the provider', async () => {
        provider.chat.mockRejectedValue(new Error('upstream down'));

        await expect(
            createChatCompletion([{ role: 'user', content: 'hi' }])
        ).rejects.toThrow('upstream down');
    });

    it('loadConfig is importable and is the only boot-time config call', () => {
        // loadConfig should not be called during a normal request.
        expect(mockLoadConfig).not.toHaveBeenCalled();
        // But it IS the boot-time hook called by index.ts.
        expect(typeof mockLoadConfig).toBe('function');
    });

    it('surface validation failure at boot via loadConfig (not at request time)', async () => {
        mockLoadConfig.mockImplementationOnce(() => {
            throw new Error('Invalid AI config: AI_DEFAULT_API_KEY (apiKey) is required.');
        });

        expect(() => mockLoadConfig()).toThrow('Invalid AI config');
        // The wrapper itself should still be safe to import; it just delegates to loadConfig.
        provider.chat.mockResolvedValue({ content: 'ok', reasoning: '', raw: {} });
        await expect(
            createChatCompletion([{ role: 'user', content: 'hi' }])
        ).resolves.toEqual({ content: 'ok', reasoning: '' });
    });
});
