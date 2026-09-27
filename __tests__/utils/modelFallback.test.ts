import {
    buildModelFallbackQueue,
    extractParameterBillions,
    isModelNotFoundError,
    rankFallbackModels,
} from '../../utils/ai/modelFallback';

describe('extractParameterBillions', () => {
    it('reads the largest Nb token from common model ids', () => {
        expect(extractParameterBillions('meta-llama/llama-3.1-70b-instruct')).toBe(70);
        expect(extractParameterBillions('nvidia/nemotron-3-ultra-550b-a55b')).toBe(550);
        expect(extractParameterBillions('org/model-7.5b-chat')).toBe(7.5);
        expect(extractParameterBillions('google/gemma-2-9b-it')).toBe(9);
    });

    it('returns null when no parameter marker is present', () => {
        expect(extractParameterBillions('tencent/hy3')).toBeNull();
        expect(extractParameterBillions('')).toBeNull();
    });
});

describe('isModelNotFoundError', () => {
    it('treats a 404 no-endpoints body as model missing', () => {
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
        const ranked = rankFallbackModels('org/small-7b', [
            'org/mid-13b',
            'org/huge-70b',
            'org/tiny-3b',
            'org/paid-405b',
        ]);

        expect(ranked).toEqual([
            'org/paid-405b',
            'org/huge-70b',
            'org/mid-13b',
            'org/tiny-3b',
        ]);
    });

    it('excludes the failed model', () => {
        expect(rankFallbackModels('a/70b', ['a/70b', 'c/8b'])).toEqual(['c/8b']);
    });

    it('does not filter by price tier — the caller chose the endpoint', () => {
        expect(rankFallbackModels('a/70b', ['b/paid-405b'])).toEqual(['b/paid-405b']);
    });

    it('uses context window as a tie-break when params match or are unknown', () => {
        const ranked = rankFallbackModels('x/unknown', ['a/hy3', 'b/other'], {
            contextById: { 'a/hy3': 262_000, 'b/other': 8_000 },
        });
        expect(ranked[0]).toBe('a/hy3');
    });

    it('deduplicates case-insensitively', () => {
        expect(rankFallbackModels('x', ['A/one', 'a/ONE'])).toEqual(['A/one']);
    });
});

describe('buildModelFallbackQueue', () => {
    it('merges declared, cached, recent and configured models without duplicates', () => {
        const queue = buildModelFallbackQueue('dead/model-1b', {
            declaredFallbackIds: ['fallback/one'],
            cachedModelIds: ['meta/llama-70b', 'tencent/hy3'],
            recentModelIds: ['meta/llama-70b'],
            configModel: 'tencent/hy3',
            flashModel: 'flash/model',
        });

        expect(queue).toContain('fallback/one');
        expect(queue).toContain('meta/llama-70b');
        expect(queue).toContain('tencent/hy3');
        expect(queue).toContain('flash/model');
        expect(new Set(queue).size).toBe(queue.length);
        expect(queue).not.toContain('dead/model-1b');
    });

    it('invents nothing when the profile has no alternates', () => {
        // The pool is the profile's own models only. An empty pool must yield an
        // empty queue so the caller surfaces the provider's real error instead
        // of trying ids this provider may not serve.
        expect(buildModelFallbackQueue('only/model', {})).toEqual([]);
        expect(
            buildModelFallbackQueue('only/model', {
                configModel: 'only/model',
                flashModel: 'only/model',
            })
        ).toEqual([]);
    });
});
