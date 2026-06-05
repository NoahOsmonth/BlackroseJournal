import {
    generateEntryReflection,
    generateEntryTitle,
    generateStreakHaiku,
    generateWeeklyInsights,
} from '../../../services/ai/insights';
import { postAgent } from '../../../services/agent/agentClient';

jest.mock('../../../services/agent/agentClient', () => ({
    postAgent: jest.fn(),
}));

const mockPostAgent = postAgent as jest.MockedFunction<typeof postAgent>;

function mockResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('insights — agent-backend mediated', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('generateEntryReflection posts to /v1/insights/reflect with entryText', async () => {
        mockPostAgent.mockResolvedValue(
            mockResponse(200, {
                data: {
                    reflection: 'You reflected well today.',
                    keyInsight: 'Small steps matter.',
                    suggestions: [
                        { type: 'HABIT', text: 'Take a 5-minute walk' },
                        { type: 'HABIT', text: 'Write down one win' },
                    ],
                },
            })
        );

        const result = await generateEntryReflection({ entryText: 'Today was tough.' });

        expect(mockPostAgent).toHaveBeenCalledTimes(1);
        const [path, payload] = mockPostAgent.mock.calls[0] as [string, Record<string, unknown>];
        expect(path).toBe('/v1/insights/reflect');
        expect(payload).toEqual({ entryText: 'Today was tough.' });
        expect(result.reflection).toBe('You reflected well today.');
        expect(result.keyInsight).toBe('Small steps matter.');
        expect(result.suggestions).toEqual([
            { type: 'HABIT', text: 'Take a 5-minute walk' },
            { type: 'HABIT', text: 'Write down one win' },
        ]);
    });

    it('generateEntryReflection returns fallback when backend fails', async () => {
        mockPostAgent.mockRejectedValue(new Error('Network unreachable'));

        const result = await generateEntryReflection({ entryText: 'Anything' });

        expect(result.reflection).toBeTruthy();
        expect(result.keyInsight).toBeTruthy();
        expect(result.suggestions.length).toBeGreaterThan(0);
        expect(result.suggestions.every((s) => s.type === 'HABIT')).toBe(true);
    });

    it('generateWeeklyInsights posts to /v1/insights/weekly with entries', async () => {
        mockPostAgent.mockResolvedValue(
            mockResponse(200, {
                data: {
                    emotionalLandscape: [
                        { emotion: 'hopeful', score: 7, emoji: '🌅' },
                        { emotion: 'tired', score: 4, emoji: '😴' },
                    ],
                    keyThemes: ['career', 'rest'],
                    castOfCharacters: ['Mom', 'Boss'],
                    weeklySummary: 'A reflective week with steady progress.',
                },
            })
        );

        const result = await generateWeeklyInsights([
            { messages: [{ content: 'First entry' }] },
            { messages: [{ content: 'Second entry' }] },
        ]);

        expect(mockPostAgent).toHaveBeenCalledTimes(1);
        const [path, payload] = mockPostAgent.mock.calls[0] as [string, Record<string, unknown>];
        expect(path).toBe('/v1/insights/weekly');
        expect(payload).toEqual({
            entries: [
                { messages: [{ content: 'First entry' }] },
                { messages: [{ content: 'Second entry' }] },
            ],
        });
        expect(result.emotionalLandscape).toHaveLength(2);
        expect(result.keyThemes).toEqual(['career', 'rest']);
        expect(result.weeklySummary).toContain('reflective');
    });

    it('generateWeeklyInsights short-circuits to empty result when no entries', async () => {
        const result = await generateWeeklyInsights([]);
        expect(mockPostAgent).not.toHaveBeenCalled();
        expect(result.emotionalLandscape).toEqual([]);
        expect(result.weeklySummary).toBe('No entries to analyze.');
    });

    it('generateEntryTitle posts to /v1/insights/title and trims quotes', async () => {
        mockPostAgent.mockResolvedValue(
            mockResponse(200, { data: { title: '"Quiet Morning"' } })
        );

        const title = await generateEntryTitle({ entryText: 'Woke up before the world.' });

        const [path, payload] = mockPostAgent.mock.calls[0] as [string, Record<string, unknown>];
        expect(path).toBe('/v1/insights/title');
        expect(payload).toEqual({ entryText: 'Woke up before the world.' });
        expect(title).toBe('Quiet Morning');
    });

    it('generateEntryTitle returns fallback when backend returns nothing', async () => {
        mockPostAgent.mockResolvedValue(mockResponse(200, { data: { title: '' } }));
        const title = await generateEntryTitle({ entryText: 'Anything' });
        expect(title).toBe('Untitled Entry');
    });

    it('generateStreakHaiku posts to /v1/insights/haiku with streakCount', async () => {
        mockPostAgent.mockResolvedValue(
            mockResponse(200, {
                data: {
                    lines: ['Day seven—still here', 'Words become lanterns', 'You are learning'],
                },
            })
        );

        const lines = await generateStreakHaiku({ entryText: 'Reflecting on a week.', streakCount: 7 });

        const [path, payload] = mockPostAgent.mock.calls[0] as [string, Record<string, unknown>];
        expect(path).toBe('/v1/insights/haiku');
        expect(payload).toEqual({ entryText: 'Reflecting on a week.', streakCount: 7 });
        expect(lines).toEqual([
            'Day seven—still here',
            'Words become lanterns',
            'You are learning',
        ]);
    });

    it('generateStreakHaiku returns fallback when backend fails', async () => {
        mockPostAgent.mockRejectedValue(new Error('Down for maintenance'));
        const lines = await generateStreakHaiku({ entryText: 'Anything', streakCount: 3 });
        expect(lines).toHaveLength(3);
        expect(lines.every((l) => typeof l === 'string' && l.length > 0)).toBe(true);
    });

    it('all four insight functions route through postAgent (no direct fetch)', async () => {
        const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
            mockResponse(200, { data: {} })
        );

        mockPostAgent.mockResolvedValue(
            mockResponse(200, {
                data: {
                    reflection: 'r',
                    keyInsight: 'k',
                    suggestions: [],
                },
            })
        );
        await generateEntryReflection({ entryText: 'x' });

        mockPostAgent.mockResolvedValue(mockResponse(200, { data: { title: 't' } }));
        await generateEntryTitle({ entryText: 'x' });

        mockPostAgent.mockResolvedValue(
            mockResponse(200, {
                data: { lines: ['a', 'b', 'c'] },
            })
        );
        await generateStreakHaiku({ entryText: 'x', streakCount: 1 });

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
        await generateWeeklyInsights([{ messages: [{ content: 'x' }] }]);

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(mockPostAgent).toHaveBeenCalledTimes(4);
        fetchSpy.mockRestore();
    });
});
