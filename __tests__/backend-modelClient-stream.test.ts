/**
 * PR4 — modelClient streaming contract.
 *
 * The new modelClient is a thin wrapper over the provider layer. It
 * delegates the network call to `getProviderForProfile('default').stream(...)`
 * and returns the upstream Response untouched. This test verifies:
 *  - The provider is invoked with `stream: true`
 *  - The returned Response is the exact same object the provider returned
 *  - The body is NOT consumed by the wrapper
 */
import { createChatCompletionStream } from '../backend/src/agent/modelClient';
import { getProviderForProfile } from '../backend/src/services/ai';

jest.mock('../backend/src/services/ai', () => {
    const actual = jest.requireActual('../backend/src/services/ai');
    return {
        ...actual,
        getProviderForProfile: jest.fn(),
    };
});

const mockGetProviderForProfile = getProviderForProfile as jest.MockedFunction<
    typeof getProviderForProfile
>;

function makeProfile() {
    return {
        apiBaseUrl: 'https://example.com/api/v1',
        apiKey: 'sk-test-key',
        model: 'test-model',
        flashModel: 'test-flash',
        capabilities: {
            streaming: true,
            reasoning: true,
            reasoningField: 'reasoning_content' as const,
            sseFormat: 'openai' as const,
            authHeaderStyle: 'bearer' as const,
        },
    };
}

function makeProvider() {
    return {
        id: 'openai-compat',
        capabilities: {
            streaming: true as const,
            reasoning: true,
            reasoningField: 'reasoning_content' as const,
            sseFormat: 'openai' as const,
            authHeaderStyle: 'bearer' as const,
        },
        resolveProfile: jest.fn(),
        chat: jest.fn(),
        stream: jest.fn(),
    };
}

describe('backend modelClient streaming (PR4 wrapper)', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('delegates to the provider with stream=true and returns the upstream Response', async () => {
        const provider = makeProvider();
        provider.resolveProfile.mockReturnValue(makeProfile());
        const upstream = new Response('data: [DONE]\n\n', {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
        });
        provider.stream.mockResolvedValue(upstream);
        mockGetProviderForProfile.mockReturnValue(provider);

        const response = await createChatCompletionStream([
            { role: 'system', content: 'sys' },
            { role: 'user', content: 'hello' },
        ]);

        expect(response).toBe(upstream);
        expect(provider.stream).toHaveBeenCalledTimes(1);
        const [req, profile] = provider.stream.mock.calls[0] as [
            { stream?: boolean; temperature?: number; maxTokens?: number },
            { model: string }
        ];
        expect(req.stream).toBe(true);
        expect(profile.model).toBe('test-model');
    });

    it('does not consume the upstream response body', async () => {
        const provider = makeProvider();
        provider.resolveProfile.mockReturnValue(makeProfile());
        const upstream = new Response('data: hello\n\n', {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
        });
        provider.stream.mockResolvedValue(upstream);
        mockGetProviderForProfile.mockReturnValue(provider);

        const response = await createChatCompletionStream([
            { role: 'user', content: 'hi' },
        ]);

        expect(response).toBe(upstream);
        const text = await response.text();
        expect(text).toBe('data: hello\n\n');
    });

    it('forwards temperature and maxTokens to the provider request', async () => {
        const provider = makeProvider();
        provider.resolveProfile.mockReturnValue(makeProfile());
        provider.stream.mockResolvedValue(new Response(''));
        mockGetProviderForProfile.mockReturnValue(provider);

        await createChatCompletionStream(
            [{ role: 'user', content: 'hi' }],
            { temperature: 0.42, maxTokens: 256 }
        );

        const [req] = provider.stream.mock.calls[0] as [
            { stream?: boolean; temperature?: number; maxTokens?: number }
        ];
        expect(req.stream).toBe(true);
        expect(req.temperature).toBe(0.42);
        expect(req.maxTokens).toBe(256);
    });
});
