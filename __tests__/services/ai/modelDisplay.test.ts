import {
    filterFreeModels,
    formatPickerModelName,
    hostLabelFromBaseUrl,
    isFreeModelId,
    preferFreeModelId,
    pushRecentModelId,
} from '../../../utils/ai/modelDisplay';

describe('modelDisplay helpers', () => {
    it('detects free model ids', () => {
        expect(isFreeModelId('tencent/hy3:free')).toBe(true);
        expect(isFreeModelId('openrouter/free')).toBe(true);
        expect(isFreeModelId('openai/gpt-4')).toBe(false);
        expect(isFreeModelId('')).toBe(false);
    });

    it('detects OmniRoute free web providers and -free suffix ids', () => {
        expect(isFreeModelId('qwen-web/qwen3.8-max')).toBe(true);
        expect(isFreeModelId('qwen-api/qwen3.8-max')).toBe(true);
        expect(isFreeModelId('ds-web/deepseek-v4-flash')).toBe(true);
        expect(isFreeModelId('deepseek-web/deepseek-chat')).toBe(true);
        expect(isFreeModelId('cgpt-web/gpt-5.5')).toBe(true);
        expect(isFreeModelId('chatgpt-web/gpt-5.6-pro')).toBe(true);
        expect(isFreeModelId('zenmux/z-ai/glm-5.3-free')).toBe(true);
        expect(isFreeModelId('cl/qwen/qwen3.8-max')).toBe(false);
        expect(isFreeModelId('openai/gpt-4')).toBe(false);
    });

    it('filters free models only', () => {
        const models = [
            { id: 'openai/gpt-4' },
            { id: 'tencent/hy3:free' },
            { id: 'openrouter/free' },
        ];
        expect(filterFreeModels(models).map((m) => m.id)).toEqual([
            'tencent/hy3:free',
            'openrouter/free',
        ]);
    });

    it('prefers preferred free id then first free', () => {
        const models = [
            { id: 'a/other:free' },
            { id: 'cl/dots-studio/dots-3-note-preview:free' },
        ];
        expect(preferFreeModelId(models, 'a/other:free')).toBe('a/other:free');
        expect(preferFreeModelId(models, null)).toBe('cl/dots-studio/dots-3-note-preview:free');
    });

    it('formats host and display names', () => {
        expect(hostLabelFromBaseUrl('https://openrouter.ai/api/v1')).toBe('openrouter.ai');
        expect(formatPickerModelName('tencent/hy3:free')).toMatch(/hy3/i);
        expect(formatPickerModelName('tencent/hy3:free')).not.toMatch(/:free/i);
    });

    it('tracks recent model ids with cap', () => {
        expect(pushRecentModelId(['a', 'b'], 'c')).toEqual(['c', 'a', 'b']);
        expect(pushRecentModelId(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b']);
        expect(pushRecentModelId(['a', 'b'], 'a')).toEqual(['a', 'b']);
    });
});
