import { completeChat, Message } from '../services/ai';
import { postAgent } from '../services/agent/agentClient';
import {
    generateEntryReflection,
    generateEntryTitle,
    generateStreakHaiku,
    generateWeeklyInsights,
} from '../services/ai/insights';

jest.mock('../services/agent/agentClient', () => ({
    postAgent: jest.fn(),
}));

const mockPostAgent = postAgent as jest.MockedFunction<typeof postAgent>;

function mockResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('AI defaults (post-PR6: no direct LLM path)', () => {
    const messages: Message[] = [
        {
            id: '1',
            role: 'user',
            content: 'hello',
            timestamp: Date.now(),
        },
    ];

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('uses chat defaults of temperature=1, max_tokens=32k (max_context is server-side, not in payload)', async () => {
        mockPostAgent.mockResolvedValue(
            mockResponse(200, {
                choices: [
                    { message: { content: 'ok', reasoning: '' } },
                ],
            })
        );

        await completeChat(messages, 'system prompt');

        const [, payload] = mockPostAgent.mock.calls[0] as [string, Record<string, unknown>];
        expect(payload).toEqual(
            expect.objectContaining({
                temperature: 1,
                max_tokens: 32768,
            })
        );
        expect(payload).not.toHaveProperty('max_context');
    });

    it('generateEntryReflection routes through postAgent to /v1/insights/reflect (no direct fetch)', async () => {
        mockPostAgent.mockResolvedValue(
            mockResponse(200, {
                data: {
                    reflection: 'ok',
                    keyInsight: 'insight',
                    suggestions: [{ type: 'HABIT', text: 'walk' }],
                },
            })
        );

        await generateEntryReflection({ entryText: 'Today was rough.' });

        expect(mockPostAgent).toHaveBeenCalledTimes(1);
        const [path, payload] = mockPostAgent.mock.calls[0] as [string, Record<string, unknown>];
        expect(path).toBe('/v1/insights/reflect');
        expect(payload).toEqual({ entryText: 'Today was rough.' });
        expect(payload).not.toHaveProperty('max_context');
        expect(payload).not.toHaveProperty('model');
    });

    it('generateEntryTitle routes through postAgent to /v1/insights/title', async () => {
        mockPostAgent.mockResolvedValue(mockResponse(200, { data: { title: 'A Quiet Day' } }));
        const title = await generateEntryTitle({ entryText: 'Reflecting.' });
        expect(title).toBe('A Quiet Day');
        const [path] = mockPostAgent.mock.calls[0] as unknown as [string];
        expect(path).toBe('/v1/insights/title');
    });

    it('generateWeeklyInsights routes through postAgent to /v1/insights/weekly', async () => {
        mockPostAgent.mockResolvedValue(
            mockResponse(200, {
                data: {
                    emotionalLandscape: [],
                    keyThemes: [],
                    castOfCharacters: [],
                    weeklySummary: 'ok',
                },
            })
        );
        await generateWeeklyInsights([{ messages: [{ content: 'm' }] }]);
        const [path] = mockPostAgent.mock.calls[0] as unknown as [string];
        expect(path).toBe('/v1/insights/weekly');
    });

    it('generateStreakHaiku routes through postAgent to /v1/insights/haiku', async () => {
        mockPostAgent.mockResolvedValue(
            mockResponse(200, { data: { lines: ['a', 'b', 'c'] } })
        );
        await generateStreakHaiku({ entryText: 'm', streakCount: 2 });
        const [path] = mockPostAgent.mock.calls[0] as unknown as [string];
        expect(path).toBe('/v1/insights/haiku');
    });
});


