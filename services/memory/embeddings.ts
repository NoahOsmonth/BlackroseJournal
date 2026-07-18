/**
 * Memory v3 embedding constants — single source of truth.
 *
 * Validated 2026-07-17 via scripts/validate-embeddings-throwaway.mjs
 * against journal-like similar/dissimilar pairs (cosine separation).
 *
 * freeOnly / assertModelAllowed (chat model picker):
 * - Those guards only apply to chat model selection in customModels.ts
 *   and the chat fallback queue in directTransport.ts.
 * - Embeddings MUST use a dedicated path (POST /embeddings) that does NOT
 *   call assertModelAllowed / freeOnly chat filters. Same API key + base URL.
 * - nvidia id ends with :free so it would pass freeOnly if accidentally gated;
 *   still keep a separate path so paid embed models remain usable without
 *   flipping the chat free-only toggle.
 *
 * Cosine: always use the full formula (dot / (||a|| ||b||)). Do not assume
 * unit-normalized storage — normalize on write for stability, but compare
 * with magnitude-aware cosine so unnormalized providers (e.g. Perplexity
 * pplx-embed) still work if swapped later.
 */

/** Locked after Phase 0 pair-separation validation (see PROGRESS / validation transcript). */
export const EMBEDDING_MODEL = 'nvidia/llama-nemotron-embed-vl-1b-v2:free' as const;

/** Observed response length from OpenRouter for EMBEDDING_MODEL. */
export const EMBEDDING_DIMENSIONS = 2048 as const;

/**
 * Human-readable notes for agents — do not treat as runtime config.
 *
 * - Runner-up: perplexity/pplx-embed-v1-0.6b (1024-d) also PASSED separation
 *   (min similar 0.514 > max dissimilar 0.219) but is paid (~$0.004/M) and
 *   returns non-unit vectors (l2 ≈ 5.25) — normalize before store if switching.
 * - nvidia passed with gap ≈ 0.34 (min similar 0.502 > max dissimilar 0.163),
 *   free, and already ~unit-normalized (l2 ≈ 1.0).
 * - Storage cost: 2048 JSON floats ≈ 16–25 KB/row. MUST use sharded keys
 *   (`@rosebud_session_digest:<id>`) — a single blob hits Android's ~2MB/key
 *   limit around ~100 digests. Aggregate DB: AsyncStorage_db_size_in_MB=50.
 *   Runway at ~1 digest/day ≈ 5+ years digest-only; shared with journals ~3–5 years.
 * - Model is multimodal (text-query ↔ image-doc retrieval) but text-to-text
 *   journal pairs separated cleanly in validation — do not skip re-validation
 *   if swapping models.
 */
export const EMBEDDING_PROVIDER_NOTES = {
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    unitNormalizedInPractice: true,
    freeOnOpenRouter: true,
    runnerUpModel: 'perplexity/pplx-embed-v1-0.6b',
    runnerUpDimensions: 1024,
    validationScript: 'scripts/validate-embeddings-throwaway.mjs',
} as const;

/**
 * Cosine similarity that is correct for both unit-normalized and raw vectors.
 * Returns 0 for empty/mismatched/zero-magnitude inputs.
 */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
    if (!a.length || a.length !== b.length) return 0;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i += 1) {
        const x = a[i];
        const y = b[i];
        dot += x * y;
        na += x * x;
        nb += y * y;
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    if (denom === 0) return 0;
    return dot / denom;
}

/** L2-normalize a vector for stable storage. Zero vector returns a copy. */
export function l2Normalize(vector: readonly number[]): number[] {
    let sumSq = 0;
    for (let i = 0; i < vector.length; i += 1) {
        sumSq += vector[i] * vector[i];
    }
    const norm = Math.sqrt(sumSq);
    if (norm === 0) return vector.slice();
    return vector.map((v) => v / norm);
}
