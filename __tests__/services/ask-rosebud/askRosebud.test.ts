/**
 * Ask Rosebud service tests — goals context integration
 */

import { askRosebud } from '../../../services/ask-rosebud/askRosebud';
import { fetchDirectChatCompletion } from '../../../services/ai/directTransport';
import { listGoals } from '../../../services/goals/goalsStorage';
import type { GoalItem } from '../../../services/goals/goalsStorage.types';

jest.mock('../../../services/ai/directConfig', () => ({
    getDirectConfig: () => ({
        apiKey: 'sk-direct-test-key',
        apiBaseUrl: 'https://nano-gpt.com/api/v1',
        model: 'moonshotai/kimi-k2.5:thinking',
        flashModel: 'moonshotai/kimi-k2.5',
    }),
}));

jest.mock('../../../services/ai/directTransport', () => ({
    fetchDirectChatCompletion: jest.fn(),
}));

jest.mock('../../../services/goals/goalsStorage', () => ({
    listGoals: jest.fn(),
}));

const mockFetchDirect = fetchDirectChatCompletion as jest.MockedFunction<
    typeof fetchDirectChatCompletion
>;
const mockListGoals = listGoals as jest.MockedFunction<typeof listGoals>;

function makeGoal(overrides: Partial<GoalItem> & Pick<GoalItem, 'id' | 'title'>): GoalItem {
    return {
        type: 'goal',
        completed: false,
        createdAt: 1,
        updatedAt: 1,
        ...overrides,
    } as GoalItem;
}

function makeHabit(overrides: Partial<GoalItem> & Pick<GoalItem, 'id' | 'title'>): GoalItem {
    return {
        type: 'habit',
        habitCompletions: [],
        createdAt: 1,
        updatedAt: 1,
        ...overrides,
    } as GoalItem;
}

describe('askRosebud service with goals context', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('loads goals and prepends the formatted goals block to the user context', async () => {
        mockListGoals.mockResolvedValue([
            makeGoal({ id: 'g1', title: 'Run a half-marathon' }),
            makeHabit({ id: 'h1', title: 'Morning meditation' }),
        ]);
        mockFetchDirect.mockResolvedValue(
            new Response(JSON.stringify({
                choices: [{ message: { content: 'Keep going!' } }],
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

        expect(answer).toBe('Keep going!');
        expect(mockListGoals).toHaveBeenCalledTimes(1);

        const [payload] = mockFetchDirect.mock.calls[0];
        const userContent = payload.messages[1].content as string;

        expect(userContent).toContain("## User's Current Goals and Habits");
        expect(userContent).toContain('- Run a half-marathon (Goal)');
        expect(userContent).toContain('- Morning meditation (daily');
        expect(userContent.indexOf("## User's Current Goals and Habits")).toBeLessThan(
            userContent.indexOf('Local journal context:')
        );
    });

    it('still works when there are no goals or habits', async () => {
        mockListGoals.mockResolvedValue([]);
        mockFetchDirect.mockResolvedValue(
            new Response(JSON.stringify({
                choices: [{ message: { content: 'ok' } }],
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const answer = await askRosebud('What did I write?', 'all-time', []);

        expect(answer).toBe('ok');
        const [payload] = mockFetchDirect.mock.calls[0];
        const userContent = payload.messages[1].content as string;
        expect(userContent).not.toContain("## User's Current Goals and Habits");
        expect(userContent).toContain('Local journal context:');
    });

    it('places goals context before the journal entries in the user message', async () => {
        mockListGoals.mockResolvedValue([
            makeGoal({ id: 'g1', title: 'Write daily' }),
        ]);
        mockFetchDirect.mockResolvedValue(
            new Response(JSON.stringify({
                choices: [{ message: { content: 'sure' } }],
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        await askRosebud('Any progress?', 'this-month', [
            {
                title: 'Entry',
                createdAt: Date.UTC(2026, 0, 2),
                messages: [{ content: 'I wrote three pages.' }],
            },
        ]);

        const [payload] = mockFetchDirect.mock.calls[0];
        const userContent = payload.messages[1].content as string;
        const goalsIdx = userContent.indexOf("## User's Current Goals and Habits");
        const entriesIdx = userContent.indexOf('Date: 2026-01-02');
        expect(goalsIdx).toBeGreaterThan(-1);
        expect(goalsIdx).toBeLessThan(entriesIdx);
    });
});
