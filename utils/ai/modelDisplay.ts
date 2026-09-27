/**
 * Pure display / model-list helpers for the chat model picker.
 * No I/O — safe for UI and services.
 *
 * Provider-agnostic by design: there is no vendor host, no preferred vendor
 * model id, and no vendor free-tier taxonomy here. Which models are visible is
 * decided entirely by a caller-supplied pattern filter (`matchesModelFilter`),
 * and which model is active is decided by the persisted provider profile.
 */

export const MAX_RECENT_MODEL_IDS = 3;

/** Substring patterns used to narrow the model list. Empty = show everything. */
export type ModelFilterPatterns = readonly string[];

/**
 * True when `modelId` passes the filter.
 *
 * An empty pattern list passes every model — the default, because the app has
 * no opinion about which ids a given endpoint serves. Patterns match as
 * case-insensitive substrings, so `':free'`, `'-free'`, or a provider prefix
 * all work without the app hardcoding any of them.
 */
export function matchesModelFilter(
    modelId: string,
    patterns: ModelFilterPatterns = []
): boolean {
    // Blank entries are dropped, so a list of only blanks behaves like no
    // filter at all rather than silently matching nothing.
    const needles = patterns
        .map((pattern) => pattern.trim().toLowerCase())
        .filter((needle) => needle.length > 0);
    if (needles.length === 0) return true;
    const id = modelId.trim().toLowerCase();
    if (!id) return false;
    return needles.some((needle) => id.includes(needle));
}

export function filterModels<T extends { id: string }>(
    models: readonly T[],
    patterns: ModelFilterPatterns = []
): T[] {
    return models.filter((model) => matchesModelFilter(model.id, patterns));
}

/**
 * Pick the active model after a model fetch, in priority order:
 * the previous selection (if still served), then the env-seed model, then the
 * first model the provider returned. Returns null when the list is empty.
 */
export function pickModelFromList(
    models: readonly { id: string }[],
    previousSelectedId?: string | null,
    seedModelId?: string | null
): string | null {
    if (previousSelectedId && models.some((model) => model.id === previousSelectedId)) {
        return previousSelectedId;
    }
    if (seedModelId && models.some((model) => model.id === seedModelId)) {
        return seedModelId;
    }
    return models[0]?.id ?? null;
}

export function hostLabelFromBaseUrl(baseUrl: string): string {
    try {
        const host = new URL(baseUrl.trim()).hostname.toLowerCase();
        return host || 'provider';
    } catch {
        return 'provider';
    }
}

/**
 * Short label for a model id in headers and rows: drop the path prefix and the
 * routing tags the provider appends. A trailing `:free` / `-free` is a routing
 * tag, not part of the model's name, so it is stripped for display.
 */
export function formatPickerModelName(modelId: string): string {
    const leaf = modelId.split('/').pop() ?? modelId;
    const name = leaf
        .replace(/:thinking$/i, '')
        .replace(/:free$/i, '')
        .replace(/-free$/i, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\bkimi\b/i, 'Kimi')
        .replace(/\bk2\.5\b/i, 'K2.5')
        .trim();
    return name || modelId;
}

export function pushRecentModelId(
    recent: readonly string[],
    modelId: string,
    max = MAX_RECENT_MODEL_IDS
): string[] {
    const next = [modelId, ...recent.filter((id) => id !== modelId)];
    return next.slice(0, max);
}
