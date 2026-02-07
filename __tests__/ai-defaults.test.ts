import { completeChat, generateEntryReflection, Message } from '../services/ai';
import { postAgent } from '../services/agent/agentClient';

jest.mock('../services/agent/agentClient', () => ({
    postAgent: jest.fn(),
}));

jest.mock('../services/ai/aiConfig', () => ({
    getAiConfig: () => ({
        apiBaseUrl: 'https://nano-gpt.com/api/v1',
        apiKey: 'test-key',
        model: 'test-model',
        flashModel: 'test-flash-model',
    }),
}));

const mockPostAgent = postAgent as jest.MockedFunction<typeof postAgent>;

describe('AI defaults', () => {
    const messages: Message[] = [
        {
            id: '1',
            role: 'user',
            content: 'hello',
            timestamp: Date.now(),
        },
    ];

    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        jest.clearAllMocks();
    });

    it('uses chat defaults of temperature=1, max_context=100k, max_tokens=32k', async () => {
        mockPostAgent.mockResolvedValue(
            new Response(
                JSON.stringify({
                    choices: [
                        {
                            message: { content: 'ok', reasoning: '' },
                        },
                    ],
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        );

        await completeChat(messages, 'system prompt');

        const [, payload] = mockPostAgent.mock.calls[0] as [string, Record<string, unknown>];
        expect(payload).toEqual(
            expect.objectContaining({
                temperature: 1,
                max_context: 100000,
                max_tokens: 32768,
            })
        );
    });

    it('uses temperature=0.7 for non-chat entry reflections', async () => {
        const fetchMock = jest.fn().mockResolvedValue(
            new Response(
                JSON.stringify({
                    choices: [
                        {
                            message: {
                                content: JSON.stringify({
                                    reflection: 'ok',
                                    keyInsight: 'insight',
                                    suggestions: [{ type: 'HABIT', text: 'walk' }],
                                }),
                            },
                        },
                    ],
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        );
        global.fetch = fetchMock as unknown as typeof fetch;

        await generateEntryReflection({ entryText: 'Today was rough.' });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
        const body = JSON.parse(String(request.body)) as {
            model: string;
            temperature: number;
            max_tokens: number;
        };

        expect(body.model).toBe('test-flash-model');
        expect(body.temperature).toBe(0.7);
        expect(body.max_tokens).toBe(900);
    });
});

