import { askRosebud } from '../services/ask-rosebud/askRosebud';
import { postAgent } from '../services/agent/agentClient';

jest.mock('../services/agent/agentClient', () => ({
    postAgent: jest.fn(),
}));

const mockPostAgent = postAgent as jest.MockedFunction<typeof postAgent>;

describe('askRosebud service', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('does not send memoryNamespace in request payload', async () => {
        mockPostAgent.mockResolvedValue(
            new Response(JSON.stringify({ data: { answer: 'ok' } }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        await askRosebud('How am I doing?', 'this-week');

        const [, payload] = mockPostAgent.mock.calls[0] as [string, Record<string, unknown>];
        expect(payload).toEqual({
            question: 'How am I doing?',
            timeRange: 'this-week',
        });
        expect(payload).not.toHaveProperty('memoryNamespace');
    });
});

