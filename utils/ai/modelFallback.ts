/**
 * Pure helpers for AI self-heal: detect missing/unavailable models and
 * rank alternate model ids by parameter size (higher billions preferred).
 * No I/O — safe for services and tests.
 */

/** Curated free ids used when the user's cached model list is empty. */
export const BUILTIN_FREE_FALLBACK_MODELS: readonly string[] = [
    'dots-studio/dots-3-note-preview:free',
    'openrouter/free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
];

/**
 * Extract the largest parameter-count marker from a model id (e.g. `70b`,
 * `550b`, `7.5b`). Returns null when the id has no `Nb` token.
 */
export function extractParameterBillions(modelId: string): number | null {
    const id = modelId.trim().toLowerCase();
    if (!id) return null;

    // Match tokens like 70b, 7.5b, 550b — not letters after `b` (avoids `base`).
    const re = /(?:^|[^a-z0-9])(\d+(?:\.\d+)?)b(?![a-z])/g;
    let max: number | null = null;
    let match: RegExpExecArray | null;
    while ((match = re.exec(id)) !== null) {
        const n = Number(match[1]);
        if (!Number.isFinite(n) || n <= 0) continue;
        max = max === null ? n : Math.max(max, n);
    }
    return max;
}

const MODEL_MISSING_HINTS = [
    'model not found',
    'no endpoints',
    'does not exist',
    'invalid model',
    'unknown model',
    'model_not_found',
    'not a valid model',
    'is not available',
    'model is unavailable',
    'no such model',
    'cannot find model',
    'failed to find model',
] as const;

/**
 * True when the provider is rejecting the *model id* (gone, no routes, free
 * pool empty for that slug) rather than a generic request error.
 */
export function isModelNotFoundError(status: number, bodyText: string): boolean {
    const lower = (bodyText || '').toLowerCase();
    const hasHint = MODEL_MISSING_HINTS.some((hint) => lower.includes(hint));

    if (status === 404) {
        // OpenRouter/NanoGPT often 404 with "No endpoints found for …".
        // Bare 404 with no body is still usually a bad/missing model on
        // /chat/completions (wrong base URL fails all fallbacks the same).
        return hasHint || lower.includes('model') || lower.trim().length === 0;
    }

    if (status === 400 || status === 422 || status === 503) {
        return hasHint;
    }

    return false;
}

export interface FallbackRankOptions {
    /** When true (default), only keep free-tier model ids. */
    freeOnly?: boolean;
    /** Optional context windows keyed by model id (tie-break). */
    contextById?: ReadonlyMap<string, number> | Readonly<Record<string, number>>;
}

function readContext(
    id: string,
    contextById?: FallbackRankOptions['contextById']
): number {
    if (!contextById) return 0;
    if (contextById instanceof Map) return contextById.get(id) ?? 0;
    return contextById[id] ?? 0;
}

function isFreeId(id: string): boolean {
    const n = id.trim().toLowerCase();
    return n.includes(':free') || n === 'openrouter/free';
}

/**
 * Rank alternate models for self-heal after the active model is missing.
 * Prefers higher parameter counts (and higher context as a tie-break).
 * Excludes the failed model. When the failed model has a known size, models
 * with *at least* that many billions are preferred first; smaller ones still
 * follow so something is always tried.
 */
export function rankFallbackModels(
    failedModelId: string,
    candidates: readonly string[],
    options: FallbackRankOptions = {}
): string[] {
    const freeOnly = options.freeOnly !== false;
    const failed = failedModelId.trim();
    const failedParams = extractParameterBillions(failed);

    const unique = new Map<string, string>();
    for (const raw of candidates) {
        const id = raw.trim();
        if (!id || id === failed) continue;
        if (freeOnly && !isFreeId(id)) continue;
        const key = id.toLowerCase();
        if (!unique.has(key)) unique.set(key, id);
    }

    const scored = [...unique.values()].map((id) => {
        const params = extractParameterBillions(id);
        const context = readContext(id, options.contextById);
        const meetsOrExceeds =
            failedParams === null || params === null || params >= failedParams;
        return { id, params: params ?? -1, context, meetsOrExceeds };
    });

    scored.sort((a, b) => {
        // Prefer models that are at least as large as the failed one.
        if (a.meetsOrExceeds !== b.meetsOrExceeds) {
            return a.meetsOrExceeds ? -1 : 1;
        }
        // Higher parameter count first.
        if (b.params !== a.params) return b.params - a.params;
        // Larger context window as soft quality signal.
        if (b.context !== a.context) return b.context - a.context;
        return a.id.localeCompare(b.id);
    });

    return scored.map((row) => row.id);
}

/**
 * Build the ordered fallback list from cached provider models + builtins.
 */
export function buildModelFallbackQueue(
    failedModelId: string,
    pool: {
        cachedModelIds?: readonly string[];
        recentModelIds?: readonly string[];
        configModel?: string | null;
        flashModel?: string | null;
        freeOnly?: boolean;
        contextById?: FallbackRankOptions['contextById'];
    }
): string[] {
    const candidates = [
        ...(pool.cachedModelIds ?? []),
        ...(pool.recentModelIds ?? []),
        pool.configModel ?? '',
        pool.flashModel ?? '',
        ...BUILTIN_FREE_FALLBACK_MODELS,
    ];
    return rankFallbackModels(failedModelId, candidates, {
        freeOnly: pool.freeOnly,
        contextById: pool.contextById,
    });
}
