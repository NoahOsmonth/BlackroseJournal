import {
    buildModelFallbackQueue,
    extractParameterBillions,
    isModelNotFoundError,
    rankFallbackModels,
} from '../../../utils/ai/modelFallback';
import { formatPickerModelName, matchesModelFilter } from '../../../utils/ai/modelDisplay';

describe('model utils edge probes', () => {
    it('extracts the largest parameter marker and ignores letters after b', () => {
        expect(extractParameterBillions('nvidia/nemotron-3-ultra-550b-a55b')).toBe(550);
        expect(extractParameterBillions('vendor/model')).toBeNull();
        expect(extractParameterBillions('cl/dots-studio/dots-3-note-preview:free')).toBeNull();
        expect(extractParameterBillions('deepseek-ai/deepseek-r1:70b')).toBe(70);
        expect(extractParameterBillions('')).toBeNull();
    });

    it('handles decimal parameter counts', () => {
        expect(extractParameterBillions('qwen/qwen-3-1.5b')).toBe(1.5);
    });

    it('rankFallbackModels drops dupes and prefers the larger model', () => {
        const result = rankFallbackModels('x/7b', ['a/70b', 'y/7b', 'z/free', 'a/70b']);
        expect(result).toEqual(['a/70b', 'y/7b', 'z/free']);
        expect(result).toHaveLength(3);
    });

    it('rankFallbackModels keeps every candidate — no price-tier filtering', () => {
        // A `:free` id and a plain id are both legitimate once the caller
        // configured the endpoint; the app holds no opinion about pricing.
        const result = rankFallbackModels('x/7b', ['a/70b', 'y:free', 'z/8b']);
        expect(result).toEqual(['a/70b', 'z/8b', 'y:free']);
    });

    it('rankFallbackModels never returns the failed model itself', () => {
        expect(rankFallbackModels('a/70b', ['a/70b', 'b/8b'])).toEqual(['b/8b']);
    });

    it('rankFallbackModels prefers models at least as large as the failed one', () => {
        expect(rankFallbackModels('x/70b', ['small/7b', 'big/400b']))
            .toEqual(['big/400b', 'small/7b']);
    });

    it('buildModelFallbackQueue orders the profile pool and returns empty when it has none', () => {
        const queue = buildModelFallbackQueue('gone/model', {
            declaredFallbackIds: ['a/70b'],
            cachedModelIds: ['b/8b', 'a/70b'],
            recentModelIds: ['c/7b'],
            configModel: 'gone/model',
            flashModel: 'd/9b',
        });
        expect(queue).toEqual(['a/70b', 'd/9b', 'b/8b', 'c/7b']);

        // No built-in list: an empty pool stays empty so the caller surfaces
        // the provider's own error instead of inventing ids.
        expect(buildModelFallbackQueue('gone/model', {})).toEqual([]);
    });

    it('treats bare 404 with empty body as model-not-found', () => {
        expect(isModelNotFoundError(404, '')).toBe(true);
        expect(isModelNotFoundError(404, 'Upstream timeout')).toBe(false);
        expect(isModelNotFoundError(400, 'model not found for provider')).toBe(true);
        expect(isModelNotFoundError(500, 'server error with model text')).toBe(false);
    });
});

describe('model display edge probes', () => {
    it('strips free suffix in picker name but keeps thinking', () => {
        expect(formatPickerModelName('cl/dots-studio/dots-3-note-preview:free'))
            .toBe('dots 3 note preview');
        expect(formatPickerModelName('moonshotai/kimi-k2.5:thinking')).toBe('Kimi K2.5');
    });

    it('matchesModelFilter passes everything when unfiltered', () => {
        expect(matchesModelFilter('deepseek/deepseek-v3')).toBe(true);
        expect(matchesModelFilter('deepseek/deepseek-v3', [])).toBe(true);
        // A blank-only list is "no filter", not "match nothing".
        expect(matchesModelFilter('deepseek/deepseek-v3', ['', '   '])).toBe(true);
    });

    it('matchesModelFilter applies case-insensitive substring patterns', () => {
        expect(matchesModelFilter('tencent/hy3:free', [':free'])).toBe(true);
        expect(matchesModelFilter('ds-web/gpt-5-mini', ['DS-WEB/'])).toBe(true);
        expect(matchesModelFilter('deepseek/deepseek-v3', [':free'])).toBe(false);
        expect(matchesModelFilter('deepseek/deepseek-v3', [':free', 'deepseek'])).toBe(true);
    });
});
