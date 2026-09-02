import {
    extractParameterBillions,
    isModelNotFoundError,
    rankFallbackModels,
} from '../../../utils/ai/modelFallback';
import { formatPickerModelName, isFreeModelId } from '../../../utils/ai/modelDisplay';

describe('model utils edge probes', () => {
    it('extracts the largest parameter marker and ignores letters after b', () => {
        expect(extractParameterBillions('nvidia/nemotron-3-ultra-550b-a55b')).toBe(550);
        expect(extractParameterBillions('openrouter/free')).toBeNull();
        expect(extractParameterBillions('cl/dots-studio/dots-3-note-preview:free')).toBeNull();
        expect(extractParameterBillions('deepseek-ai/deepseek-r1:70b')).toBe(70);
    });

    it('handles decimal parameter counts', () => {
        expect(extractParameterBillions('qwen/qwen-3-1.5b')).toBe(1.5);
    });

    it('rankFallbackModels drops dupes, prefers larger, and keeps free under freeOnly:false', () => {
        const result = rankFallbackModels('x/7b', ['a/70b', 'y/7b', 'z/free', 'a/70b'], { freeOnly: false });
        expect(result).toEqual(['a/70b', 'y/7b', 'z/free']);
        expect(result).toHaveLength(3);
    });

    it('rankFallbackModels keeps only ids with :free under default freeOnly', () => {
        const result = rankFallbackModels('x/7b', ['a/70b', 'y:free', 'z/8b'], {});
        expect(result).toEqual(['y:free']);
    });
});

describe('model display edge probes', () => {
    it('strips free suffix in picker name but keeps thinking', () => {
        expect(formatPickerModelName('cl/dots-studio/dots-3-note-preview:free')).toBe('dots 3 note preview');
        expect(formatPickerModelName('moonshotai/kimi-k2.5:thinking')).toBe('Kimi K2.5');
    });

    it('classifies free web providers and openrouter free', () => {
        expect(isFreeModelId('ds-web/gpt-5-mini')).toBe(true);
        expect(isFreeModelId('openrouter/free')).toBe(true);
        expect(isFreeModelId('deepseek/deepseek-v3')).toBe(false);
        expect(isFreeModelId('x/y-free')).toBe(true);
    });

    it('treats bare 404 with empty body as model-not-found', () => {
        expect(isModelNotFoundError(404, '')).toBe(true);
        expect(isModelNotFoundError(404, 'Upstream timeout')).toBe(false);
        expect(isModelNotFoundError(400, 'model not found for provider')).toBe(true);
        expect(isModelNotFoundError(500, 'server error with model text')).toBe(false);
    });
});