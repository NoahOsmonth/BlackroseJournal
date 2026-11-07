import { extractTasksForEntry, resetTaskExtractionState } from '@/services/tasks/taskExtraction';

const mockJson = jest.fn();

jest.mock('@/services/ai/jsonCompletion', () => ({
    fetchDirectJsonCompletion: (...args: unknown[]) => mockJson(...args),
    parseJsonFromModelText: (raw: string) => {
        try {
            return JSON.parse(raw) as unknown;
        } catch {
            return null;
        }
    },
}));

const ENTRY = 'I should text my brother about the holiday plan and book the train tickets before prices go up.';

describe('extractTasksForEntry', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetTaskExtractionState();
    });

    it('reads the shape it asks for', async () => {
        mockJson.mockResolvedValue({ content: '{"tasks": ["Text brother about the holiday", "Book train tickets"]}' });

        await expect(extractTasksForEntry({ entryText: ENTRY }))
            .resolves.toEqual(['Text brother about the holiday', 'Book train tickets']);
    });

    it('reads a reply wrapped in a markdown fence', async () => {
        mockJson.mockResolvedValue({ content: '```json\n{"tasks": ["Book train tickets"]}\n```' });

        await expect(extractTasksForEntry({ entryText: ENTRY }))
            .resolves.toEqual(['Book train tickets']);
    });

    it('reads a plain bulleted list instead of throwing it away', async () => {
        mockJson.mockResolvedValue({ content: '- Book train tickets\n- Text brother about the holiday' });

        await expect(extractTasksForEntry({ entryText: ENTRY }))
            .resolves.toEqual(['Book train tickets', 'Text brother about the holiday']);
    });

    it('offers nothing rather than an error when the AI is unreachable', async () => {
        mockJson.mockRejectedValue(new Error('429 rate limited'));

        await expect(extractTasksForEntry({ entryText: ENTRY })).resolves.toEqual([]);
    });

    it('does not spend a request on an entry too short to hold a task', async () => {
        await expect(extractTasksForEntry({ entryText: 'Still tired.' })).resolves.toEqual([]);
        expect(mockJson).not.toHaveBeenCalled();
    });

    it('asks once for the same words, even when two screens mount together', async () => {
        mockJson.mockResolvedValue({ content: '{"tasks": ["Book train tickets"]}' });

        const [first, second] = await Promise.all([
            extractTasksForEntry({ entryText: ENTRY }),
            extractTasksForEntry({ entryText: ENTRY }),
        ]);

        expect(mockJson).toHaveBeenCalledTimes(1);
        expect(first.concat(second)).toEqual(['Book train tickets']);
    });
});
