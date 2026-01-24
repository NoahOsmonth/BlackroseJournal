import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    CachedWeeklyInsights,
    clearCachedInsights,
    getCurrentWeekKey,
    loadCachedInsights,
    saveCachedInsights,
} from '../../services/weeklyInsightsStorage';
import {
    deleteRemoteWeeklyInsights,
    loadRemoteWeeklyInsights,
    saveRemoteWeeklyInsights,
} from '../../services/insights/weeklyInsightsRemote';

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
}));

jest.mock('../../services/insights/weeklyInsightsRemote', () => ({
    loadRemoteWeeklyInsights: jest.fn(),
    saveRemoteWeeklyInsights: jest.fn(),
    deleteRemoteWeeklyInsights: jest.fn(),
}));

describe('weeklyInsightsStorage', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    describe('getCurrentWeekKey', () => {
        it('should return a string in format YYYY-WNN', () => {
            const weekKey = getCurrentWeekKey();
            expect(weekKey).toMatch(/^\d{4}-W\d{2}$/);
        });

        it('should return consistent key for the same week', () => {
            const key1 = getCurrentWeekKey();
            const key2 = getCurrentWeekKey();
            expect(key1).toBe(key2);
        });
    });

    describe('loadCachedInsights', () => {
        it('should return null when no cache exists', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
            (loadRemoteWeeklyInsights as jest.Mock).mockResolvedValue(null);

            const result = await loadCachedInsights('2026-W04');

            expect(result).toBeNull();
        });

        it('should return null when cache is for a different week', async () => {
            const cached: CachedWeeklyInsights = {
                weekKey: '2026-W03',
                insights: {
                    emotionalLandscape: [],
                    keyThemes: [],
                    castOfCharacters: [],
                    weeklySummary: 'Test summary',
                },
                cachedAt: Date.now(),
                entryCount: 2,
            };

            (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cached));

            const result = await loadCachedInsights('2026-W04');

            expect(result).toBeNull();
        });

        it('should return cached insights when week key matches', async () => {
            const cached: CachedWeeklyInsights = {
                weekKey: '2026-W04',
                insights: {
                    emotionalLandscape: [{ emotion: 'Happy', score: 8, emoji: '😊' }],
                    keyThemes: ['Work'],
                    castOfCharacters: ['Boss'],
                    weeklySummary: 'Good week',
                },
                cachedAt: Date.now(),
                entryCount: 3,
            };

            (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cached));

            const result = await loadCachedInsights('2026-W04');

            expect(result).toEqual(cached);
        });

        it('should load remote insights when local cache is missing', async () => {
            const remote = {
                weekKey: '2026-W04',
                insights: {
                    emotionalLandscape: [],
                    keyThemes: [],
                    castOfCharacters: [],
                    weeklySummary: 'Remote summary',
                },
                cachedAt: Date.now(),
                entryCount: 1,
            };

            (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
            (loadRemoteWeeklyInsights as jest.Mock).mockResolvedValue(remote);

            const result = await loadCachedInsights('2026-W04');

            expect(result).toEqual(remote);
            expect(AsyncStorage.setItem).toHaveBeenCalled();
        });

        it('should handle storage errors gracefully', async () => {
            (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

            const result = await loadCachedInsights('2026-W04');

            expect(result).toBeNull();
        });
    });

    describe('saveCachedInsights', () => {
        it('should save insights to storage', async () => {
            const insights = {
                emotionalLandscape: [{ emotion: 'Calm', score: 7, emoji: '😌' }],
                keyThemes: ['Health'],
                castOfCharacters: ['Doctor'],
                weeklySummary: 'Peaceful week',
            };

            await saveCachedInsights('2026-W04', insights, 5);

            expect(AsyncStorage.setItem).toHaveBeenCalledWith(
                '@weekly_insights_cache',
                expect.stringContaining('2026-W04')
            );
            expect(saveRemoteWeeklyInsights).toHaveBeenCalledWith('2026-W04', insights, 5);

            const savedData = JSON.parse(
                (AsyncStorage.setItem as jest.Mock).mock.calls[0][1]
            );
            expect(savedData.weekKey).toBe('2026-W04');
            expect(savedData.insights).toEqual(insights);
            expect(savedData.entryCount).toBe(5);
            expect(savedData.cachedAt).toBeDefined();
        });

        it('should throw on storage errors', async () => {
            (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Write error'));

            await expect(
                saveCachedInsights('2026-W04', {
                    emotionalLandscape: [],
                    keyThemes: [],
                    castOfCharacters: [],
                    weeklySummary: 'Test'
                }, 1)
            ).rejects.toThrow('Write error');
        });
    });

    describe('clearCachedInsights', () => {
        it('should remove cached insights from storage', async () => {
            await clearCachedInsights();

            expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@weekly_insights_cache');
            expect(deleteRemoteWeeklyInsights).toHaveBeenCalled();
        });

        it('should throw on storage errors', async () => {
            (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(new Error('Remove error'));

            await expect(clearCachedInsights()).rejects.toThrow('Remove error');
        });
    });
});
