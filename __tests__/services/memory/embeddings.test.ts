/**
 * Embedding constants + cosine helpers.
 * What would make this fail: wrong locked model/dim, or cosine that assumes unit norm only.
 */

import {
    EMBEDDING_DIMENSIONS,
    EMBEDDING_MODEL,
    cosineSimilarity,
    l2Normalize,
} from '../../../services/memory/embeddings';

describe('embeddings constants (Memory v3 Phase 0 lock)', () => {
    it('locks the validated free nvidia model at 2048-d', () => {
        expect(EMBEDDING_MODEL).toBe('nvidia/llama-nemotron-embed-vl-1b-v2:free');
        expect(EMBEDDING_DIMENSIONS).toBe(2048);
    });

    it('cosineSimilarity is magnitude-aware (unnormalized vectors)', () => {
        // Same direction, different scale — cosine must be 1.
        const a = [3, 4];
        const b = [6, 8];
        expect(cosineSimilarity(a, b)).toBeCloseTo(1, 6);

        // Orthogonal
        expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);

        // Opposite
        expect(cosineSimilarity([1, 0], [-2, 0])).toBeCloseTo(-1, 6);
    });

    it('l2Normalize produces unit vectors used with cosine', () => {
        const n = l2Normalize([3, 4]);
        expect(Math.hypot(n[0], n[1])).toBeCloseTo(1, 6);
        expect(cosineSimilarity(n, l2Normalize([6, 8]))).toBeCloseTo(1, 6);
    });
});
