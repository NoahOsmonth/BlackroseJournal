import {
    resolveGenerationSettings,
    temperatureForImagination,
} from '../../../services/ai/generationSettings';

describe('persona imagination temperature mapping', () => {
    it('maps low, medium, and high imagination into expected temperature bands', () => {
        expect(temperatureForImagination(0)).toBe(0.3);
        expect(temperatureForImagination(50)).toBeGreaterThanOrEqual(0.7);
        expect(temperatureForImagination(50)).toBeLessThanOrEqual(1);
        expect(temperatureForImagination(100)).toBe(2);
    });

    it('lets persona imagination override flow and global temperature', () => {
        const result = resolveGenerationSettings(
            { temperature: 0.4, topP: 0.8, maxTokens: 2_048 },
            { temperature: 1.1 },
            100
        );

        expect(result.temperature).toBe(2);
        expect(result.topP).toBe(0.8);
        expect(result.maxTokens).toBe(2_048);
    });
});
