import { completeChat, Message } from '../services/ai';
import {
    generateEntryAnalysis,
    generateEntryReflection,
    generateEntryTitle,
    generateStreakHaiku,
    generateWeeklyInsights,
} from '../services/ai/insights';

jest.mock('../services/ai/directConfig', () => ({
    getDirectConfig: () => ({
        apiKey: 'sk-direct-test-key',
        apiBaseUrl: 'https://nano-gpt.com/api/v1',
        model: 'nvidia/nemotron-3-ultra-550b-a55b',
        flashModel: 'nvidia/nemotron-3-ultra-550b-a55b',
    }),
    getResolvedDirectConfig: () => Promise.resolve({
        apiKey: 'sk-direct-test-key',
        apiBaseUrl: 'https://nano-gpt.com/api/v1',
        model: 'nvidia/nemotron-3-ultra-550b-a55b',
        flashModel: 'nvidia/nemotron-3-ultra-550b-a55b',
        source: 'env',
    }),
}));

function mockChatResponse(content: string): Response {
    return new Response(JSON.stringify({
        choices: [{ message: { content, reasoning: '' } }],
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('AI defaults — direct local NanoGPT', () => {
    const messages: Message[] = [
        {
            id: '1',
            role: 'user',
            content: 'hello',
            timestamp: Date.now(),
        },
    ];
    const originalFetch = global.fetch;
    let fetchMock: jest.Mock;

    beforeEach(() => {
        fetchMock = jest.fn();
        global.fetch = fetchMock as unknown as typeof fetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
        jest.clearAllMocks();
    });

    it('uses chat defaults without backend-only fields', async () => {
        fetchMock.mockResolvedValue(mockChatResponse('ok'));

        await completeChat(messages, 'system prompt', { conversationId: 'local-1' });

        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        expect(body).toEqual(expect.objectContaining({
            model: 'nvidia/nemotron-3-ultra-550b-a55b',
            temperature: 1,
            max_tokens: 32768,
        }));
        expect(body).not.toHaveProperty('conversationId');
        expect(body).not.toHaveProperty('max_context');
    });

    it('routes insight helpers directly to NanoGPT with the flash model', async () => {
        fetchMock
            .mockResolvedValueOnce(mockChatResponse(JSON.stringify({
                reflection: 'r',
                keyInsight: 'k',
                suggestions: [],
            })))
            .mockResolvedValueOnce(mockChatResponse(JSON.stringify({ title: 't' })))
            .mockResolvedValueOnce(mockChatResponse(JSON.stringify({
                insight: 'i',
                quote: 'q',
                mood: 'm',
                topics: ['t'],
            })))
            .mockResolvedValueOnce(mockChatResponse(JSON.stringify({ lines: ['a', 'b', 'c'] })))
            .mockResolvedValueOnce(mockChatResponse(JSON.stringify({
                emotionalLandscape: [],
                keyThemes: [],
                castOfCharacters: [],
                weeklySummary: 'ok',
            })));

        await generateEntryReflection({ entryText: 'x' });
        await generateEntryTitle({ entryText: 'x' });
        await generateEntryAnalysis({ entryText: 'x' });
        await generateStreakHaiku({ entryText: 'x', streakCount: 1 });
        await generateWeeklyInsights([{ messages: [{ content: 'x' }] }]);

        expect(fetchMock).toHaveBeenCalledTimes(5);
        for (const call of fetchMock.mock.calls) {
            const [, init] = call as [string, RequestInit];
            const body = JSON.parse(String(init.body)) as Record<string, unknown>;
            expect(body.model).toBe('nvidia/nemotron-3-ultra-550b-a55b');
            expect(body.temperature).toBe(0.7);
            expect(body).not.toHaveProperty('conversationId');
        }
    });
});
