/**
 * Pure display / free-model helpers for chat model picker.
 * No I/O — safe for UI and services.
 */

export const PREFERRED_FREE_MODEL_ID = 'dots-studio/dots-3-note-preview:free';
export const OPENROUTER_DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
export const MAX_RECENT_MODEL_IDS = 3;

/** Free = id contains `:free` or is OpenRouter's free router. */
export function isFreeModelId(id: string): boolean {
    const n = id.trim().toLowerCase();
    if (!n) return false;
    return n.includes(':free') || n === 'openrouter/free';
}

export function filterFreeModels<T extends { id: string }>(models: readonly T[]): T[] {
    return models.filter((model) => isFreeModelId(model.id));
}

export function preferFreeModelId(
    models: readonly { id: string }[],
    preferredId?: string | null
): string | null {
    if (preferredId && models.some((model) => model.id === preferredId && isFreeModelId(preferredId))) {
        return preferredId;
    }
    if (models.some((model) => model.id === PREFERRED_FREE_MODEL_ID)) {
        return PREFERRED_FREE_MODEL_ID;
    }
    const free = filterFreeModels(models);
    return free[0]?.id ?? null;
}

export function hostLabelFromBaseUrl(baseUrl: string): string {
    try {
        const host = new URL(baseUrl.trim()).hostname.toLowerCase();
        return host || 'provider';
    } catch {
        return 'provider';
    }
}

/** Short label for headers: strip path prefix and trailing free/thinking tags when a Free badge is shown. */
export function formatPickerModelName(modelId: string, options?: { stripFreeSuffix?: boolean }): string {
    const leaf = modelId.split('/').pop() ?? modelId;
    let name = leaf
        .replace(/:thinking$/i, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\bkimi\b/i, 'Kimi')
        .replace(/\bk2\.5\b/i, 'K2.5');
    if (options?.stripFreeSuffix !== false && isFreeModelId(modelId)) {
        name = name.replace(/\s*:?\s*free$/i, '').trim();
    }
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
