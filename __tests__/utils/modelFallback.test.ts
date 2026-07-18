import {
    BUILTIN_FREE_FALLBACK_MODELS,
    buildModelFallbackQueue,
    extractParameterBillions,
    isModelNotFoundError,
    rankFallbackModels,
} from '../../utils/ai/modelFallback';

describe('extractParameterBillions', () => {
    it('reads the largest Nb token from common model ids', () => {
        expect(extractParameterBillions('meta-llama/llama-3.1-70b-instruct:free')).toBe(70);
        expect(extractParameterBillions('nvidia/nemotron-3-ultra-550b-a55b:free')).toBe(550);
        expect(extractParameterBillions('org/model-7.5b-chat')).toBe(7.5);
        expect(extractParameterBillions('google/gemma-2-9b-it:free')).toBe(9);
    });

    it('returns null when no parameter marker is present', () => {
        expect(extractParameterBillions('tencent/hy3:free')).toBeNull();
        expect(extractParameterBillions('openrouter/free')).toBeNull();
        expect(extractParameterBillions('')).toBeNull();
    });
});

describe('isModelNotFoundError', () => {
    it('treats OpenRouter-style 404 no-endpoints as model missing', () => {
        expect(
            isModelNotFoundError(404, JSON.stringify({ error: { message: 'No endpoints found for model x' } }))
        ).toBe(true);
    });

    it('treats explicit model-not-found 400 bodies as model missing', () => {
        expect(isModelNotFoundError(400, 'Model not found: foo/bar')).toBe(true);
        expect(isModelNotFoundError(422, 'invalid model id')).toBe(true);
    });

    it('does not treat generic 400 validation as model missing', () => {
        expect(isModelNotFoundError(400, 'temperature must be between 0 and 2')).toBe(false);
        expect(isModelNotFoundError(401, 'unauthorized')).toBe(false);
        expect(isModelNotFoundError(429, 'rate limited')).toBe(false);
    });

    it('treats empty-body 404 as model missing on chat completions', () => {
        expect(isModelNotFoundError(404, '')).toBe(true);
    });
});

describe('rankFallbackModels', () => {
    it('orders higher parameter models first and prefers >= failed size', () => {
        const ranked = rankFallbackModels('org/small-7b:free', [
            'org/mid-13b:free',
            'org/huge-70b:free',
            'org/tiny-3b:free',
            'org/paid-405b',
        ], { freeOnly: true });

        expect(ranked).toEqual([
            'org/huge-70b:free',
            'org/mid-13b:free',
            'org/tiny-3b:free',
        ]);
    });

    it('excludes the failed model and respects freeOnly', () => {
        const ranked = rankFallbackModels('a/70b:free', [
            'a/70b:free',
            'b/paid-405b',
            'c/8b:free',
        ], { freeOnly: true });
        expect(ranked).toEqual(['c/8b:free']);
    });

    it('uses context window as a tie-break when params match or are unknown', () => {
        const ranked = rankFallbackModels('x/unknown:free', [
            'a/hy3:free',
            'b/other:free',
        ], {
            freeOnly: true,
            contextById: { 'a/hy3:free': 262_000, 'b/other:free': 8_000 },
        });
        expect(ranked[0]).toBe('a/hy3:free');
    });
});

describe('buildModelFallbackQueue', () => {
    it('merges cache, recent, config, and builtins without duplicates', () => {
        const queue = buildModelFallbackQueue('dead/model-1b:free', {
            cachedModelIds: ['meta/llama-70b:free', 'tencent/hy3:free'],
            recentModelIds: ['meta/llama-70b:free'],
            configModel: 'tencent/hy3:free',
            flashModel: 'openrouter/free',
            freeOnly: true,
        });
        // Builtin 550b ranks above cached 70b
        expect(queue[0]).toBe('nvidia/nemotron-3-ultra-550b-a55b:free');
        expect(queue[1]).toBe('meta/llama-70b:free');
        expect(queue).toContain('tencent/hy3:free');
        expect(queue).toContain('openrouter/free');
        expect(new Set(queue).size).toBe(queue.length);
        expect(queue).not.toContain('dead/model-1b:free');
        expect(
            BUILTIN_FREE_FALLBACK_MODELS.every((id) => queue.includes(id))
        ).toBe(true);
    });
});

