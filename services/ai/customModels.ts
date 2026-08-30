import {
    DEFAULT_AI_BASE_URL,
    filterFreeModels,
    isFreeModelId,
    OPENROUTER_DEFAULT_BASE_URL,
    preferFreeModelId,
    pushRecentModelId,
} from '@/utils/ai/modelDisplay';
import { accountScopedStorage } from '@/services/account/accountScopedStorage';
import { runAccountBoundOperation } from '@/services/account/accountRuntime';

export type ContextWindowSource = 'api' | 'known' | 'fallback';

export interface CustomAiModel {
    readonly id: string;
    readonly name?: string;
    readonly ownedBy?: string;
    readonly created?: number;
    readonly contextWindow: number;
    readonly contextWindowSource: ContextWindowSource;
}

export interface CustomAiProviderSettings {
    readonly enabled: boolean;
    readonly baseUrl: string;
    readonly apiKey: string;
    readonly selectedModelId: string | null;
    readonly models: CustomAiModel[];
    readonly freeOnly: boolean;
    readonly recentModelIds: readonly string[];
    readonly fallbackContextWindow: number;
    readonly updatedAt: number;
    readonly lastFetchedAt?: number;
    readonly lastFetchError?: string;
}

export interface ActiveCustomModelConfig {
    readonly apiBaseUrl: string;
    readonly apiKey: string;
    readonly model: string;
    readonly flashModel: string;
    readonly contextWindow: number;
    readonly contextWindowSource: ContextWindowSource;
}

interface StorageAdapter {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
}

type ModelRecord = Record<string, unknown>;

export const CUSTOM_AI_SETTINGS_KEY = '@blackrose_custom_ai_provider';
export const DEFAULT_FALLBACK_CONTEXT_WINDOW = 128_000;
export { DEFAULT_AI_BASE_URL, OPENROUTER_DEFAULT_BASE_URL };

const MAX_FALLBACK_CONTEXT_WINDOW = 2_000_000;
const CONTEXT_KEYS = [
    'context_length',
    'contextWindow',
    'context_window',
    'max_context_length',
    'max_context_tokens',
    'max_input_tokens',
    'max_total_tokens',
];
const NESTED_CONTEXT_PATHS = [
    ['limits', 'context_window'],
    ['limits', 'context_length'],
    ['model_info', 'context_window'],
    ['model_info', 'context_length'],
    ['top_provider', 'context_length'],
];
const KNOWN_CONTEXT_WINDOWS: Record<string, number> = {
    'nvidia/nemotron-3-ultra-550b-a55b': 1_000_000,
    'nvidia/nemotron-3-ultra-550b-a55b:free': 1_000_000,
    'dots-studio/dots-3-note-preview:free': 512_000,
    'cl/dots-studio/dots-3-note-preview:free': 128_000,
    'moonshotai/kimi-k2.5:thinking': 128_000,
    'moonshotai/kimi-k2.5': 128_000,
};

const asyncStorageAdapter: StorageAdapter = accountScopedStorage;

let storageAdapter: StorageAdapter = asyncStorageAdapter;
let settingsMutationQueue: Promise<unknown> = Promise.resolve();

function withSettingsMutation<T>(task: () => Promise<T>): Promise<T> {
    return runAccountBoundOperation('custom-ai-settings', async () => {
        const run = settingsMutationQueue.then(task, task);
        settingsMutationQueue = run.catch(() => undefined);
        return run;
    });
}

const changeListeners = new Set<() => void>();

function notifyCustomAiSettingsChanged(): void {
    for (const listener of changeListeners) {
        try {
            listener();
        } catch {
            // ignore subscriber errors
        }
    }
}

/** Subscribe to custom AI provider setting mutations (select/save/fetch). */
export function subscribeCustomAiSettingsChanges(listener: () => void): () => void {
    changeListeners.add(listener);
    return () => {
        changeListeners.delete(listener);
    };
}

export class CustomModelSettingsError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CustomModelSettingsError';
    }
}

export function setCustomModelStorageAdapter(adapter: StorageAdapter): void {
    storageAdapter = adapter;
}

export function resetCustomModelStorageAdapter(): void {
    storageAdapter = asyncStorageAdapter;
}

/** Env-backed credentials for first-run bootstrap (Expo inlines EXPO_PUBLIC_*). */
export function readEnvProviderSeed(): { baseUrl: string; apiKey: string; model?: string } {
    const apiKey = (process.env.EXPO_PUBLIC_NANO_GPT_API_KEY ?? '').trim();
    const baseUrl = (process.env.EXPO_PUBLIC_NANO_GPT_API_BASE_URL ?? '').trim()
        || DEFAULT_AI_BASE_URL;
    const model = (process.env.EXPO_PUBLIC_NANO_GPT_MODEL ?? '').trim() || undefined;
    return { baseUrl, apiKey, model };
}

export function getDefaultCustomAiProviderSettings(): CustomAiProviderSettings {
    const seed = readEnvProviderSeed();
    const hasKey = Boolean(seed.apiKey) && seed.apiKey !== 'YOUR_NANO_GPT_API_KEY'
        && seed.apiKey !== 'YOUR_OPENROUTER_API_KEY';
    return {
        enabled: false,
        baseUrl: seed.baseUrl || DEFAULT_AI_BASE_URL,
        apiKey: hasKey ? seed.apiKey : '',
        selectedModelId: null,
        models: [],
        freeOnly: false,
        recentModelIds: [],
        fallbackContextWindow: DEFAULT_FALLBACK_CONTEXT_WINDOW,
        updatedAt: 0,
    };
}

function isRecord(value: unknown): value is ModelRecord {
    return typeof value === 'object' && value !== null;
}

function toPositiveInteger(value: unknown): number | undefined {
    const parsed = typeof value === 'string' ? Number(value) : value;
    if (typeof parsed !== 'number' || !Number.isFinite(parsed)) return undefined;
    const rounded = Math.floor(parsed);
    return rounded > 0 ? rounded : undefined;
}

export function normalizeFallbackContextWindow(value: unknown): number {
    const parsed = toPositiveInteger(value) ?? DEFAULT_FALLBACK_CONTEXT_WINDOW;
    return Math.min(Math.max(parsed, 1_024), MAX_FALLBACK_CONTEXT_WINDOW);
}

export function normalizeOpenAiBaseUrl(input: string): string {
    const trimmed = input.trim().replace(/\/+$/, '');
    if (!trimmed) throw new CustomModelSettingsError('Base URL is required.');

    let parsed: URL;
    try {
        parsed = new URL(trimmed);
    } catch {
        throw new CustomModelSettingsError('Base URL must be a valid http(s) URL.');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new CustomModelSettingsError('Base URL must start with http:// or https://.');
    }

    if (parsed.pathname === '' || parsed.pathname === '/') {
        parsed.pathname = parsed.hostname === 'openrouter.ai' ? '/api/v1' : '/v1';
    }

    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
}

function normalizeApiKey(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) throw new CustomModelSettingsError('API key is required.');
    return trimmed;
}

function readNested(record: ModelRecord, path: readonly string[]): unknown {
    return path.reduce<unknown>((current, key) => (
        isRecord(current) ? current[key] : undefined
    ), record);
}

export function readContextFromApi(record: ModelRecord): number | undefined {
    for (const key of CONTEXT_KEYS) {
        const value = toPositiveInteger(record[key]);
        if (value) return value;
    }

    for (const path of NESTED_CONTEXT_PATHS) {
        const value = toPositiveInteger(readNested(record, path));
        if (value) return value;
    }

    return undefined;
}

export function getKnownContextWindow(modelId: string): number | undefined {
    const normalized = modelId.toLowerCase();
    return KNOWN_CONTEXT_WINDOWS[normalized];
}

function buildModel(record: unknown, fallbackContextWindow: number): CustomAiModel | null {
    if (!isRecord(record) || typeof record.id !== 'string' || !record.id.trim()) {
        return null;
    }

    const apiContext = readContextFromApi(record);
    const knownContext = getKnownContextWindow(record.id);
    const contextWindow = apiContext ?? knownContext ?? fallbackContextWindow;
    const source: ContextWindowSource = apiContext
        ? 'api'
        : knownContext ? 'known' : 'fallback';

    return {
        id: record.id,
        name: typeof record.name === 'string' ? record.name : undefined,
        ownedBy: typeof record.owned_by === 'string' ? record.owned_by : undefined,
        created: toPositiveInteger(record.created),
        contextWindow,
        contextWindowSource: source,
    };
}

function isContextWindowSource(value: unknown): value is ContextWindowSource {
    return value === 'api' || value === 'known' || value === 'fallback';
}

function sanitizeStoredModel(record: unknown, fallbackContextWindow: number): CustomAiModel | null {
    if (!isRecord(record) || typeof record.id !== 'string' || !record.id.trim()) {
        return null;
    }

    const contextWindow = toPositiveInteger(record.contextWindow) ?? fallbackContextWindow;
    const source = isContextWindowSource(record.contextWindowSource)
        ? record.contextWindowSource
        : 'fallback';

    return {
        id: record.id,
        name: typeof record.name === 'string' ? record.name : undefined,
        ownedBy: typeof record.ownedBy === 'string' ? record.ownedBy : undefined,
        created: toPositiveInteger(record.created),
        contextWindow,
        contextWindowSource: source,
    };
}

export function parseOpenAiCompatibleModels(
    response: unknown,
    fallbackContextWindow = DEFAULT_FALLBACK_CONTEXT_WINDOW
): CustomAiModel[] {
    const fallback = normalizeFallbackContextWindow(fallbackContextWindow);
    const data = Array.isArray(response)
        ? response
        : isRecord(response) && Array.isArray(response.data) ? response.data : null;

    if (!data) {
        throw new CustomModelSettingsError('Model response did not include a data array.');
    }

    return data
        .map((item) => buildModel(item, fallback))
        .filter((item): item is CustomAiModel => item !== null)
        .sort((a, b) => a.id.localeCompare(b.id));
}

function sanitizeModels(value: unknown, fallback: number): CustomAiModel[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => sanitizeStoredModel(item, fallback))
        .filter((item): item is CustomAiModel => item !== null);
}

function sanitizeRecentIds(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .slice(0, 3);
}

/**
 * Apply free-only policy: clear invalid selection; never drop models from cache
 * (UI filters). Selection must be free when freeOnly is on.
 */
export function applyFreeOnlyPolicy(settings: CustomAiProviderSettings): CustomAiProviderSettings {
    if (!settings.freeOnly) return settings;
    const selected = settings.selectedModelId;
    if (selected && !isFreeModelId(selected)) {
        return { ...settings, selectedModelId: null };
    }
    return settings;
}

function sanitizeSettings(value: unknown): CustomAiProviderSettings {
    const defaults = getDefaultCustomAiProviderSettings();
    if (!isRecord(value)) return defaults;
    const fallback = normalizeFallbackContextWindow(value.fallbackContextWindow);
    const selectedModelId = typeof value.selectedModelId === 'string'
        ? value.selectedModelId
        : null;
    const freeOnly = value.freeOnly !== false;
    const baseUrl = typeof value.baseUrl === 'string' && value.baseUrl.trim()
        ? value.baseUrl
        : defaults.baseUrl;

    const next: CustomAiProviderSettings = {
        enabled: value.enabled === true,
        baseUrl,
        apiKey: typeof value.apiKey === 'string' ? value.apiKey : defaults.apiKey,
        selectedModelId,
        models: sanitizeModels(value.models, fallback),
        freeOnly,
        recentModelIds: sanitizeRecentIds(value.recentModelIds),
        fallbackContextWindow: fallback,
        updatedAt: toPositiveInteger(value.updatedAt) ?? defaults.updatedAt,
        lastFetchedAt: toPositiveInteger(value.lastFetchedAt),
        lastFetchError: typeof value.lastFetchError === 'string'
            ? value.lastFetchError
            : undefined,
    };
    return applyFreeOnlyPolicy(next);
}

export async function loadCustomAiProviderSettings(): Promise<CustomAiProviderSettings> {
    return runAccountBoundOperation('custom-ai-settings-read', async () => {
        const json = await storageAdapter.getItem(CUSTOM_AI_SETTINGS_KEY);
        if (!json) return getDefaultCustomAiProviderSettings();
        try {
            return sanitizeSettings(JSON.parse(json));
        } catch {
            return getDefaultCustomAiProviderSettings();
        }
    });
}

export async function saveCustomAiProviderSettings(
    settings: CustomAiProviderSettings
): Promise<CustomAiProviderSettings> {
    return withSettingsMutation(async () => {
        const normalized = sanitizeSettings({ ...settings, updatedAt: Date.now() });
        await storageAdapter.setItem(CUSTOM_AI_SETTINGS_KEY, JSON.stringify(normalized));
        notifyCustomAiSettingsChanged();
        return normalized;
    });
}

export async function clearCustomAiProviderSettings(): Promise<void> {
    await withSettingsMutation(async () => {
        await storageAdapter.removeItem(CUSTOM_AI_SETTINGS_KEY);
        notifyCustomAiSettingsChanged();
    });
}

export function assertModelAllowed(modelId: string, freeOnly: boolean): void {
    if (freeOnly && !isFreeModelId(modelId)) {
        throw new CustomModelSettingsError(
            'Free models only. Paid model ids are blocked while Free only is on.'
        );
    }
}

export async function fetchOpenAiCompatibleModels(input: {
    readonly baseUrl: string;
    readonly apiKey: string;
    readonly fallbackContextWindow?: number;
    readonly freeOnly?: boolean;
    readonly signal?: AbortSignal;
}): Promise<{ readonly baseUrl: string; readonly models: CustomAiModel[]; readonly fetchedAt: number }> {
    const baseUrl = normalizeOpenAiBaseUrl(input.baseUrl);
    const apiKey = normalizeApiKey(input.apiKey);
    const freeOnly = input.freeOnly === true;
    const response = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        ...(input.signal ? { signal: input.signal } : {}),
    }).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Network request failed.';
        throw new CustomModelSettingsError(`Could not reach the model endpoint. ${message}`);
    });

    if (!response.ok) {
        const preview = await response.text().catch(() => '');
        throw new CustomModelSettingsError(
            `Model fetch failed with status ${response.status}. ${preview.slice(0, 160)}`
        );
    }

    const json = await response.json().catch(() => {
        throw new CustomModelSettingsError('Model endpoint did not return valid JSON.');
    });
    let models = parseOpenAiCompatibleModels(json, input.fallbackContextWindow);
    if (freeOnly) {
        models = filterFreeModels(models);
    }
    if (models.length === 0) {
        throw new CustomModelSettingsError(
            freeOnly
                ? 'No free models were returned. Free mode only keeps ids with :free (or openrouter/free).'
                : 'No usable models were returned.'
        );
    }

    return { baseUrl, models, fetchedAt: Date.now() };
}

export function withSelectedModel(
    settings: CustomAiProviderSettings,
    modelId: string
): CustomAiProviderSettings {
    assertModelAllowed(modelId, settings.freeOnly);
    const selected = settings.models.find((model) => model.id === modelId);
    if (!selected) {
        throw new CustomModelSettingsError('Selected model is not available.');
    }
    return {
        ...settings,
        enabled: true,
        selectedModelId: modelId,
        recentModelIds: pushRecentModelId(settings.recentModelIds, modelId),
    };
}

export function pickModelAfterFetch(
    models: readonly CustomAiModel[],
    previousSelectedId: string | null,
    preferredEnvModel?: string
): string | null {
    return preferFreeModelId(models, previousSelectedId)
        ?? preferFreeModelId(models, preferredEnvModel)
        ?? models[0]?.id
        ?? null;
}

/**
 * Build a custom model entry from a hand-typed id (escape hatch when the
 * provider's `/models` response can't be fetched or parsed). Context window
 * is the fallback value; it is never marked as API-detected.
 */
export function buildManualModel(id: string, fallbackContextWindow: number): CustomAiModel {
    const normalizedId = id.trim();
    if (!normalizedId) throw new CustomModelSettingsError('Model id is required.');
    return {
        id: normalizedId,
        contextWindow: normalizeFallbackContextWindow(fallbackContextWindow),
        contextWindowSource: 'fallback',
    };
}

/**
 * Add (or refresh) a manually-entered model, select it, and enable the provider.
 * Honors the free-only policy: paid ids are rejected while freeOnly is on.
 */
export function withManualModel(
    settings: CustomAiProviderSettings,
    id: string,
    fallbackContextWindow: number
): CustomAiProviderSettings {
    const model = buildManualModel(id, fallbackContextWindow);
    assertModelAllowed(model.id, settings.freeOnly);
    const exists = settings.models.some((entry) => entry.id === model.id);
    const models = exists
        ? settings.models.map((entry) => (entry.id === model.id
            ? { ...entry, ...model, name: entry.name, ownedBy: entry.ownedBy }
            : entry))
        : [...settings.models, model];
    return {
        ...settings,
        enabled: true,
        models,
        selectedModelId: model.id,
        recentModelIds: pushRecentModelId(settings.recentModelIds, model.id),
    };
}

export async function getActiveCustomModelConfig(): Promise<ActiveCustomModelConfig | null> {
    const settings = await loadCustomAiProviderSettings();
    if (!settings.enabled) return null;

    const apiBaseUrl = normalizeOpenAiBaseUrl(settings.baseUrl);
    const apiKey = normalizeApiKey(settings.apiKey);
    const selected = settings.models.find((model) => model.id === settings.selectedModelId);
    if (!selected) {
        throw new CustomModelSettingsError('Custom provider is enabled but no model is selected.');
    }
    assertModelAllowed(selected.id, settings.freeOnly);

    return {
        apiBaseUrl,
        apiKey,
        model: selected.id,
        flashModel: selected.id,
        contextWindow: selected.contextWindow,
        contextWindowSource: selected.contextWindowSource,
    };
}

export { isFreeModelId, filterFreeModels };
