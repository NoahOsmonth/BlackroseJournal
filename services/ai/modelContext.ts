import { getResolvedDirectConfig, type ResolvedDirectConfig } from './directConfig';
import {
    DEFAULT_FALLBACK_CONTEXT_WINDOW,
    getKnownContextWindow,
    parseOpenAiCompatibleModels,
    type ContextWindowSource,
} from './customModels';

interface StorageAdapter {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
}

export interface ModelContextInfo {
    model: string;
    contextWindow: number;
    source: ContextWindowSource;
    providerSource: ResolvedDirectConfig['source'];
}

interface CachedModelContext {
    model: string;
    contextWindow: number;
    source: ContextWindowSource;
    updatedAt: number;
}

export const MODEL_CONTEXT_CACHE_KEY = '@blackrose_model_context_cache';

async function getAsyncStorage(): Promise<StorageAdapter> {
    const module = await import('@react-native-async-storage/async-storage');
    return module.default;
}

const asyncStorageAdapter: StorageAdapter = {
    getItem: async (key) => (await getAsyncStorage()).getItem(key),
    setItem: async (key, value) => (await getAsyncStorage()).setItem(key, value),
    removeItem: async (key) => (await getAsyncStorage()).removeItem(key),
};

let storageAdapter: StorageAdapter = asyncStorageAdapter;

function baseUrl(input: string): string {
    return input.replace(/\/+$/, '');
}

function cacheKey(config: ResolvedDirectConfig): string {
    return `${baseUrl(config.apiBaseUrl)}::${config.model}`;
}

function fallbackContext(model: string): CachedModelContext {
    const known = getKnownContextWindow(model);
    return {
        model,
        contextWindow: known ?? DEFAULT_FALLBACK_CONTEXT_WINDOW,
        source: known ? 'known' : 'fallback',
        updatedAt: Date.now(),
    };
}

async function loadCache(): Promise<Record<string, CachedModelContext>> {
    const json = await storageAdapter.getItem(MODEL_CONTEXT_CACHE_KEY);
    if (!json) return {};
    try {
        const parsed = JSON.parse(json);
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
        return {};
    }
}

async function saveCache(key: string, value: CachedModelContext): Promise<void> {
    const cache = await loadCache();
    await storageAdapter.setItem(MODEL_CONTEXT_CACHE_KEY, JSON.stringify({
        ...cache,
        [key]: value,
    }));
}

async function fetchDefaultContext(config: ResolvedDirectConfig): Promise<CachedModelContext> {
    const response = await fetch(`${baseUrl(config.apiBaseUrl)}/models`, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
        },
    });
    if (!response.ok) throw new Error(`Model fetch failed with status ${response.status}.`);
    const models = parseOpenAiCompatibleModels(await response.json(), DEFAULT_FALLBACK_CONTEXT_WINDOW);
    const active = models.find((model) => model.id === config.model);
    if (!active) return fallbackContext(config.model);
    return {
        model: active.id,
        contextWindow: active.contextWindow,
        source: active.contextWindowSource,
        updatedAt: Date.now(),
    };
}

function toInfo(
    config: ResolvedDirectConfig,
    context: CachedModelContext
): ModelContextInfo {
    return {
        model: context.model,
        contextWindow: context.contextWindow,
        source: context.source,
        providerSource: config.source,
    };
}

export function setModelContextStorageAdapter(adapter: StorageAdapter): void {
    storageAdapter = adapter;
}

export function resetModelContextStorageAdapter(): void {
    storageAdapter = asyncStorageAdapter;
}

export async function clearModelContextCache(): Promise<void> {
    await storageAdapter.removeItem(MODEL_CONTEXT_CACHE_KEY);
}

export async function detectActiveModelContextWindow(
    options: { forceRefresh?: boolean } = {}
): Promise<ModelContextInfo> {
    const config = await getResolvedDirectConfig();
    if (config.source === 'custom' && config.contextWindow) {
        return {
            model: config.model,
            contextWindow: config.contextWindow,
            source: config.contextWindowSource ?? 'fallback',
            providerSource: config.source,
        };
    }

    const key = cacheKey(config);
    const cached = (await loadCache())[key];
    if (cached && !options.forceRefresh) return toInfo(config, cached);

    const detected = await fetchDefaultContext(config).catch(() => fallbackContext(config.model));
    await saveCache(key, detected);
    return toInfo(config, detected);
}

export function formatContextWindow(value: number): string {
    if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}M`;
    if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
    return String(value);
}

export function formatModelName(model: string): string {
    const leaf = model.split('/').pop() ?? model;
    return leaf
        .replace(/:thinking$/i, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\bkimi\b/i, 'Kimi')
        .replace(/\bk2\.5\b/i, 'K2.5');
}

export function formatModelContextLabel(info: ModelContextInfo): string {
    return `${formatModelName(info.model)} · ${formatContextWindow(info.contextWindow)} ctx`;
}
