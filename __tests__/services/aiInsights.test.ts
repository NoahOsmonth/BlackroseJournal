import { generateWeeklyInsights } from '../../services/ai';

// Mock the AI config and fetch
jest.mock('../../services/ai/aiConfig', () => ({
  getAiConfig: jest.fn(() => ({
    apiBaseUrl: 'https://mock-api.com',
    apiKey: 'mock-key',
    model: 'mock-model',
    flashModel: 'mock-flash-model',
  })),
}));

global.fetch = jest.fn();

// Helper to create a mock API response
function createMockResponse(content: string, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: jest.fn().mockResolvedValue({
      choices: [{ message: { content } }],
    }),
    text: jest.fn().mockResolvedValue(content),
  };
}

describe('generateWeeklyInsights', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should generate structured insights from entries', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              emotionalLandscape: [
                { emotion: 'Happy', score: 8, emoji: '😊' },
                { emotion: 'Anxious', score: 3, emoji: '😰' }
              ],
              keyThemes: ['Work', 'Family'],
              castOfCharacters: ['Mom', 'Boss'],
              weeklySummary: 'A mostly positive week.'
            }),
          },
        },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const entries: any[] = [
      { id: '1', messages: [{ content: 'Had a great day at work.' }] },
      { id: '2', messages: [{ content: 'Mom called, nice chat.' }] }
    ];

    const resultPromise = generateWeeklyInsights(entries);
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toEqual({
      emotionalLandscape: [
        { emotion: 'Happy', score: 8, emoji: '😊' },
        { emotion: 'Anxious', score: 3, emoji: '😰' }
      ],
      keyThemes: ['Work', 'Family'],
      castOfCharacters: ['Mom', 'Boss'],
      weeklySummary: 'A mostly positive week.'
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should retry on JSON parsing errors', async () => {
    const validResponse = JSON.stringify({
      emotionalLandscape: [{ emotion: 'Happy', score: 7, emoji: '😊' }],
      keyThemes: ['Success'],
      castOfCharacters: ['Friend'],
      weeklySummary: 'Good recovery.'
    });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(createMockResponse('Not valid JSON'))
      .mockResolvedValueOnce(createMockResponse(validResponse));

    const entries: any[] = [{ messages: [{ content: 'Test content' }] }];

    const resultPromise = generateWeeklyInsights(entries);

    // Run past the first failure and delay
    await jest.advanceTimersByTimeAsync(3000);
    await jest.runAllTimersAsync();

    const result = await resultPromise;

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.weeklySummary).toBe('Good recovery.');
  });

  it('should retry on rate limit errors (429)', async () => {
    const validResponse = JSON.stringify({
      emotionalLandscape: [],
      keyThemes: ['Retry'],
      castOfCharacters: [],
      weeklySummary: 'After rate limit.'
    });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: jest.fn().mockResolvedValue('Rate limit exceeded'),
      })
      .mockResolvedValueOnce(createMockResponse(validResponse));

    const entries: any[] = [{ messages: [{ content: 'Rate limited test' }] }];

    const resultPromise = generateWeeklyInsights(entries);
    await jest.advanceTimersByTimeAsync(3000);
    await jest.runAllTimersAsync();

    const result = await resultPromise;

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.keyThemes).toEqual(['Retry']);
  });

  it('should give up after max retries and return fallback', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValue(createMockResponse('Invalid JSON forever'));

    const entries: any[] = [{ messages: [{ content: 'Failing test' }] }];

    const resultPromise = generateWeeklyInsights(entries);

    // Advance through all retry delays
    await jest.advanceTimersByTimeAsync(3000);
    await jest.advanceTimersByTimeAsync(3000);
    await jest.advanceTimersByTimeAsync(3000);
    await jest.runAllTimersAsync();

    const result = await resultPromise;

    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      emotionalLandscape: [],
      keyThemes: [],
      castOfCharacters: [],
      weeklySummary: 'Could not generate insights at this time.'
    });
  });

  it('should handle invalid JSON responses gracefully', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: 'Not JSON',
          },
        },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const entries: any[] = [{ messages: [{ content: 'Test content' }] }];

    const resultPromise = generateWeeklyInsights(entries);

    // Run through all retries
    await jest.advanceTimersByTimeAsync(3000);
    await jest.advanceTimersByTimeAsync(3000);
    await jest.advanceTimersByTimeAsync(3000);
    await jest.runAllTimersAsync();

    const result = await resultPromise;

    // Expect fallback/empty structure
    expect(result).toEqual({
      emotionalLandscape: [],
      keyThemes: [],
      castOfCharacters: [],
      weeklySummary: 'Could not generate insights at this time.'
    });
  });

  it('should return empty result for entries with no content', async () => {
    const entries: any[] = [{ messages: [{ content: '' }] }];

    const resultPromise = generateWeeklyInsights(entries);
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.weeklySummary).toBe('No entries to analyze.');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
