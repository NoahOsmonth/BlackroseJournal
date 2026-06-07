import {
    generateEntryAnalysis,
    generateEntryReflection,
    generateEntryTitle,
    generateStreakHaiku,
    generateWeeklyInsights,
} from '../../../services/ai/insights';
import { fetchDirectChatCompletion } from '../../../services/ai/directTransport';

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

const mockFetchDirect = fetchDirectChatCompletion as jest.MockedFunction<
    typeof fetchDirectChatCompletion
>;

function mockResponse(status: number, content: unknown): Response {
    return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify(content) } }],
    }), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('insights — direct local NanoGPT', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('generateEntryReflection posts a JSON-mode prompt with entry text', async () => {
        mockFetchDirect.mockResolvedValue(
            mockResponse(200, {
                reflection: 'You reflected well today.',
                keyInsight: 'Small steps matter.',
                suggestions: [
                    { type: 'HABIT', text: 'Take a 5-minute walk' },
                    { type: 'HABIT', text: 'Write down one win' },
                ],
            })
        );

        const result = await generateEntryReflection({ entryText: 'Today was tough.' });

        expect(mockFetchDirect).toHaveBeenCalledTimes(1);
        const [payload] = mockFetchDirect.mock.calls[0];
        expect(payload.model).toBe('moonshotai/kimi-k2.5');
        expect(payload.response_format).toEqual({ type: 'json_object' });
        expect(payload.messages[1]?.content).toContain('Today was tough.');
        expect(result.reflection).toBe('You reflected well today.');
        expect(result.keyInsight).toBe('Small steps matter.');
        expect(result.suggestions).toEqual([
            { type: 'HABIT', text: 'Take a 5-minute walk' },
            { type: 'HABIT', text: 'Write down one win' },
        ]);
    });

    it('generateEntryReflection returns fallback when NanoGPT fails', async () => {
        mockFetchDirect.mockRejectedValue(new Error('Network unreachable'));

        const result = await generateEntryReflection({ entryText: 'Anything' });

        expect(result.reflection).toBeTruthy();
        expect(result.keyInsight).toBeTruthy();
        expect(result.suggestions.length).toBeGreaterThan(0);
        expect(result.suggestions.every((s) => s.type === 'HABIT')).toBe(true);
    });

    it('generateEntryAnalysis posts entry text and normalizes history analysis', async () => {
        mockFetchDirect.mockResolvedValue(
            mockResponse(200, {
                insight: 'You are asking for steadier routines.',
                quote: 'A quiet plan can hold the day.',
                mood: 'Grounded',
                topics: ['Routines', 'Energy', 'Planning'],
            })
        );

        const result = await generateEntryAnalysis({ entryText: 'I need a calmer morning.' });

        const [payload] = mockFetchDirect.mock.calls[0];
        expect(payload.messages[0]?.content).toContain('"insight"');
        expect(payload.messages[1]?.content).toContain('I need a calmer morning.');
        expect(result).toEqual({
            insight: 'You are asking for steadier routines.',
            quote: 'A quiet plan can hold the day.',
            mood: 'Grounded',
            topics: ['Routines', 'Energy', 'Planning'],
        });
    });

    it('generateEntryAnalysis returns fallback when NanoGPT fails', async () => {
        mockFetchDirect.mockRejectedValue(new Error('Network unreachable'));

        const result = await generateEntryAnalysis({ entryText: 'Anything' });

        expect(result.insight).toBeTruthy();
        expect(result.quote).toBeTruthy();
        expect(result.mood).toBeTruthy();
        expect(result.topics.length).toBeGreaterThan(0);
    });

    it('generateWeeklyInsights posts combined entries and parses analysis', async () => {
        mockFetchDirect.mockResolvedValue(
            mockResponse(200, {
                emotionalLandscape: [
                    { emotion: 'hopeful', score: 7, emoji: 'sunrise' },
                    { emotion: 'tired', score: 4, emoji: 'sleepy' },
                ],
                keyThemes: ['career', 'rest'],
                castOfCharacters: ['Mom', 'Boss'],
                weeklySummary: 'A reflective week with steady progress.',
            })
        );

        const result = await generateWeeklyInsights([
            { messages: [{ content: 'First entry' }] },
            { messages: [{ content: 'Second entry' }] },
        ]);

        expect(mockFetchDirect).toHaveBeenCalledTimes(1);
        const [payload] = mockFetchDirect.mock.calls[0];
        expect(payload.messages[1]?.content).toContain('First entry');
        expect(payload.messages[1]?.content).toContain('Second entry');
        expect(result.emotionalLandscape).toHaveLength(2);
        expect(result.keyThemes).toEqual(['career', 'rest']);
        expect(result.weeklySummary).toContain('reflective');
    });

    it('generateWeeklyInsights short-circuits to empty result when no entries', async () => {
        const result = await generateWeeklyInsights([]);
        expect(mockFetchDirect).not.toHaveBeenCalled();
        expect(result.emotionalLandscape).toEqual([]);
        expect(result.weeklySummary).toBe('No entries to analyze.');
    });

    it('generateEntryTitle parses and trims generated title JSON', async () => {
        mockFetchDirect.mockResolvedValue(mockResponse(200, { title: '"Quiet Morning"' }));

        const title = await generateEntryTitle({ entryText: 'Woke up before the world.' });

        const [payload] = mockFetchDirect.mock.calls[0];
        expect(payload.messages[1]?.content).toContain('Woke up before the world.');
        expect(title).toBe('Quiet Morning');
    });

    it('generateEntryTitle returns fallback when NanoGPT returns nothing', async () => {
        mockFetchDirect.mockResolvedValue(mockResponse(200, { title: '' }));
        const title = await generateEntryTitle({ entryText: 'Anything' });
        expect(title).toBe('Untitled Entry');
    });

    it('generateStreakHaiku posts streak count and parses three lines', async () => {
        mockFetchDirect.mockResolvedValue(
            mockResponse(200, {
                lines: ['Day seven still here', 'Words become lanterns', 'You are learning'],
            })
        );

        const lines = await generateStreakHaiku({ entryText: 'Reflecting.', streakCount: 7 });

        const [payload] = mockFetchDirect.mock.calls[0];
        expect(payload.messages[1]?.content).toContain('Streak: 7');
        expect(lines).toEqual([
            'Day seven still here',
            'Words become lanterns',
            'You are learning',
        ]);
    });

    it('generateStreakHaiku returns fallback when NanoGPT fails', async () => {
        mockFetchDirect.mockRejectedValue(new Error('Down for maintenance'));
        const lines = await generateStreakHaiku({ entryText: 'Anything', streakCount: 3 });
        expect(lines).toHaveLength(3);
        expect(lines.every((l) => typeof l === 'string' && l.length > 0)).toBe(true);
    });
});
