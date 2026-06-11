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
    'moonshotai/kimi-k2.5:thinking': 128_000,
    'moonshotai/kimi-k2.5': 128_000,
};

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

export function getDefaultCustomAiProviderSettings(): CustomAiProviderSettings {
    return {
        enabled: false,
        baseUrl: '',
        apiKey: '',
        selectedModelId: null,
        models: [],
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

function sanitizeSettings(value: unknown): CustomAiProviderSettings {
    const defaults = getDefaultCustomAiProviderSettings();
    if (!isRecord(value)) return defaults;
    const fallback = normalizeFallbackContextWindow(value.fallbackContextWindow);
    const selectedModelId = typeof value.selectedModelId === 'string'
        ? value.selectedModelId
        : null;

    return {
        enabled: value.enabled === true,
        baseUrl: typeof value.baseUrl === 'string' ? value.baseUrl : '',
        apiKey: typeof value.apiKey === 'string' ? value.apiKey : '',
        selectedModelId,
        models: sanitizeModels(value.models, fallback),
        fallbackContextWindow: fallback,
        updatedAt: toPositiveInteger(value.updatedAt) ?? defaults.updatedAt,
        lastFetchedAt: toPositiveInteger(value.lastFetchedAt),
        lastFetchError: typeof value.lastFetchError === 'string'
            ? value.lastFetchError
            : undefined,
    };
}

export async function loadCustomAiProviderSettings(): Promise<CustomAiProviderSettings> {
    const json = await storageAdapter.getItem(CUSTOM_AI_SETTINGS_KEY);
    if (!json) return getDefaultCustomAiProviderSettings();
    try {
        return sanitizeSettings(JSON.parse(json));
    } catch {
        return getDefaultCustomAiProviderSettings();
    }
}

export async function saveCustomAiProviderSettings(
    settings: CustomAiProviderSettings
): Promise<CustomAiProviderSettings> {
    const normalized = sanitizeSettings({ ...settings, updatedAt: Date.now() });
    await storageAdapter.setItem(CUSTOM_AI_SETTINGS_KEY, JSON.stringify(normalized));
    return normalized;
}

export async function clearCustomAiProviderSettings(): Promise<void> {
    await storageAdapter.removeItem(CUSTOM_AI_SETTINGS_KEY);
}

export async function fetchOpenAiCompatibleModels(input: {
    readonly baseUrl: string;
    readonly apiKey: string;
    readonly fallbackContextWindow?: number;
    readonly signal?: AbortSignal;
}): Promise<{ readonly baseUrl: string; readonly models: CustomAiModel[]; readonly fetchedAt: number }> {
    const baseUrl = normalizeOpenAiBaseUrl(input.baseUrl);
    const apiKey = normalizeApiKey(input.apiKey);
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
    const models = parseOpenAiCompatibleModels(json, input.fallbackContextWindow);
    if (models.length === 0) {
        throw new CustomModelSettingsError('No usable models were returned.');
    }

    return { baseUrl, models, fetchedAt: Date.now() };
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

    return {
        apiBaseUrl,
        apiKey,
        model: selected.id,
        flashModel: selected.id,
        contextWindow: selected.contextWindow,
        contextWindowSource: selected.contextWindowSource,
    };
}
