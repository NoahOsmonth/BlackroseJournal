import { createGoal, listGoals } from '@/services/goals/goalsStorage';
import { getLocalDateKey } from '@/utils/date';
import { createGoalTool, listGoalsTool } from '../../../services/ai/tools/goalsTools';
import {
    HISTORY_TOOL_DEFINITIONS,
    toOpenAiToolSpecs,
} from '../../../services/ai/tools';

jest.mock('@/services/goals/goalsStorage', () => ({
    listGoals: jest.fn(),
    createGoal: jest.fn(),
}));

const mockListGoals = listGoals as jest.MockedFunction<typeof listGoals>;
const mockCreateGoal = createGoal as jest.MockedFunction<typeof createGoal>;

describe('goals tools', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('listGoalsTool formats goals with type, date, and completion', async () => {
        mockListGoals.mockResolvedValue([
            {
                id: 'g1',
                title: 'Run a marathon',
                type: 'goal',
                dateKey: '2026-08-20',
                completed: false,
                createdAt: 1,
                updatedAt: 1,
            },
            {
                id: 'h1',
                title: 'Drink water',
                type: 'habit',
                dateKey: '2026-08-01',
                habitCompletions: ['2026-08-18'],
                createdAt: 2,
                updatedAt: 2,
            },
        ]);
        const out = await listGoalsTool({});
        expect(out).toContain('Run a marathon');
        expect(out).toContain('[goal]');
        expect(out).toContain('date: 2026-08-20');
        expect(out).toContain('completed: no');
        expect(out).toContain('Drink water');
        expect(out).toContain('[habit]');
        expect(out).toContain('date: 2026-08-01');
        expect(out).toContain('completed: yes');
    });

    it('listGoalsTool reports a friendly empty state', async () => {
        mockListGoals.mockResolvedValue([]);
        const out = await listGoalsTool({});
        expect(out).toContain('No goals yet');
    });

    it('createGoalTool requires a title and does not create', async () => {
        const out = await createGoalTool({});
        expect(out).toBe('Error: title is required.');
        expect(mockCreateGoal).not.toHaveBeenCalled();
    });

    it('createGoalTool creates a habit with today dateKey', async () => {
        mockCreateGoal.mockResolvedValue({
            id: 'g9',
            title: 'Meditate',
            type: 'habit',
            dateKey: getLocalDateKey(new Date()),
            habitCompletions: [],
            createdAt: 1,
            updatedAt: 1,
        });
        const today = getLocalDateKey(new Date());
        const out = await createGoalTool({ title: 'Meditate', type: 'habit' });
        expect(mockCreateGoal).toHaveBeenCalledWith({
            title: 'Meditate',
            type: 'habit',
            dateKey: today,
        });
        expect(out).toContain('Created habit');
        expect(out).toContain('id: g9');
    });

    it('createGoalTool defaults type to goal', async () => {
        mockCreateGoal.mockResolvedValue({
            id: 'g10',
            title: 'Learn piano',
            type: 'goal',
            dateKey: getLocalDateKey(new Date()),
            completed: false,
            createdAt: 1,
            updatedAt: 1,
        });
        const out = await createGoalTool({ title: 'Learn piano' });
        expect(mockCreateGoal).toHaveBeenCalledWith({
            title: 'Learn piano',
            type: 'goal',
            dateKey: expect.any(String),
        });
        expect(out).toContain('Created goal');
    });

    it('create_goal schema is exposed with required title and no extra props', () => {
        const specs = toOpenAiToolSpecs(HISTORY_TOOL_DEFINITIONS);
        const spec = specs.find((s) => s.function.name === 'create_goal');
        expect(spec).toBeDefined();
        expect(spec!.function.parameters.required).toEqual(['title']);
        expect(spec!.function.parameters.additionalProperties).toBe(false);
    });
});
