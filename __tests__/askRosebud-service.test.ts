import { askRosebud } from '../services/ask-rosebud/askRosebud';
import { fetchDirectChatCompletion } from '../services/ai/directTransport';

jest.mock('../services/ai/directConfig', () => ({
    getDirectConfig: () => ({
        apiKey: 'sk-direct-test-key',
        apiBaseUrl: 'https://nano-gpt.com/api/v1',
        model: 'moonshotai/kimi-k2.5:thinking',
        flashModel: 'moonshotai/kimi-k2.5',
    }),
}));

jest.mock('../services/ai/directTransport', () => ({
    fetchDirectChatCompletion: jest.fn(),
}));

const mockFetchDirect = fetchDirectChatCompletion as jest.MockedFunction<
    typeof fetchDirectChatCompletion
>;

describe('askRosebud service', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('posts directly to NanoGPT without memory namespace', async () => {
        mockFetchDirect.mockResolvedValue(
            new Response(JSON.stringify({
                choices: [{ message: { content: 'ok' } }],
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const answer = await askRosebud('How am I doing?', 'this-week', [
            {
                title: 'Monday',
                createdAt: Date.UTC(2026, 0, 1),
                messages: [{ content: 'I felt focused after walking.' }],
            },
        ]);

        expect(answer).toBe('ok');
        const [payload] = mockFetchDirect.mock.calls[0];
        expect(payload.model).toBe('moonshotai/kimi-k2.5');
        expect(payload.temperature).toBe(0.7);
        expect(payload.messages[1]).toEqual({
            role: 'user',
            content: [
                'Time range: this-week',
                'Question: How am I doing?',
                'Local journal context:',
                'Date: 2026-01-01',
                'Title: Monday',
                'Entry:',
                'I felt focused after walking.',
            ].join('\n'),
        });
        expect(payload).not.toHaveProperty('memoryNamespace');
    });
});
