import {
    aboutSummary,
    accountSummary,
    appearanceSummary,
    colorThemeSummary,
    customAiSummary,
    dataManagementSummary,
    generationSummary,
    identitySettingsSummary,
    memorySummary,
} from '@/components/settings/settingsSummaries';
import { DEFAULT_COLOR_THEME } from '@/constants/theme';
import { DEFAULT_GENERATION } from '@/services/ai/generationSettings';
import { getDefaultCustomAiProviderSettings } from '@/services/ai/customModels';

describe('settingsSummaries', () => {
    it('formats appearance, generation, and color summaries', () => {
        expect(appearanceSummary('dark', 'flat')).toBe('Dark · Flat');
        expect(generationSummary(DEFAULT_GENERATION)).toBe('Balanced');
        expect(colorThemeSummary(DEFAULT_COLOR_THEME)).toBe('Rosebud');
        expect(colorThemeSummary({ ...DEFAULT_COLOR_THEME, presetId: 'custom' })).toBe('Custom');
    });

    it('formats custom AI, memory, account, data, and about', () => {
        const off = getDefaultCustomAiProviderSettings();
        expect(customAiSummary(off)).toBe('Off');
        expect(customAiSummary({
            ...off,
            enabled: true,
            freeOnly: true,
            selectedModelId: 'gpt-test',
            models: [{
                id: 'gpt-test',
                name: 'GPT Test',
                contextWindow: 8000,
                contextWindowSource: 'fallback',
            }],
        })).toBe('Free · GPT Test');

        expect(memorySummary(0)).toBe('No memories yet');
        expect(memorySummary(1)).toBe('1 memory');
        expect(identitySettingsSummary(null)).toBe('Not set');
        expect(identitySettingsSummary({
            schemaVersion: 1,
            preferredName: {
                value: 'Ren',
                confidence: 1,
                source: 'manual',
                updatedAt: 1,
            },
            keyPeople: [],
            facts: [],
            updatedAt: 1,
        })).toBe('Ren');
        expect(memorySummary(12)).toBe('12 memories');
        expect(accountSummary(null)).toBe('Signed out');
        expect(accountSummary('me@example.com')).toBe('me@example.com');
        expect(dataManagementSummary(true)).toBe('Backup · Export');
        expect(aboutSummary()).toMatch(/^v/);
    });
});
