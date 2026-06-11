export interface GenerationSettings {
    temperature: number;
    topP: number;
    maxTokens: number;
}

export interface GenerationPreset extends GenerationSettings {
    id: 'consistent' | 'balanced' | 'creative';
    label: string;
}

interface StorageAdapter {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
}

export const GENERATION_SETTINGS_KEY = '@blackrose_generation_settings';
export const INSIGHTS_TEMPERATURE = 0.7;
export const DEFAULT_GENERATION: GenerationSettings = {
    temperature: 1,
    topP: 0.9,
    maxTokens: 32_768,
};

export const GENERATION_PRESETS: GenerationPreset[] = [
    { id: 'consistent', label: 'Consistent', temperature: 0.3, topP: 0.75, maxTokens: 32_768 },
    { id: 'balanced', label: 'Balanced', temperature: 1, topP: 0.9, maxTokens: 32_768 },
    { id: 'creative', label: 'Creative', temperature: 1.7, topP: 0.95, maxTokens: 32_768 },
];

const MIN_MAX_TOKENS = 256;
const FALLBACK_MAX_TOKENS = 2_000_000;

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

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function toFiniteNumber(value: unknown): number | undefined {
    const parsed = typeof value === 'string' ? Number(value) : value;
    return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : undefined;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function tokenCap(contextWindow?: number): number {
    const parsed = toFiniteNumber(contextWindow);
    return parsed && parsed > 0 ? Math.floor(parsed) : FALLBACK_MAX_TOKENS;
}

export function setGenerationSettingsStorageAdapter(adapter: StorageAdapter): void {
    storageAdapter = adapter;
}

export function resetGenerationSettingsStorageAdapter(): void {
    storageAdapter = asyncStorageAdapter;
}

export function sanitizeGenerationSettings(
    value?: Partial<GenerationSettings> | null,
    contextWindow?: number
): GenerationSettings {
    const source = isRecord(value) ? value : {};
    const max = Math.max(MIN_MAX_TOKENS, tokenCap(contextWindow));
    return {
        temperature: clamp(toFiniteNumber(source.temperature) ?? DEFAULT_GENERATION.temperature, 0, 2),
        topP: clamp(toFiniteNumber(source.topP) ?? DEFAULT_GENERATION.topP, 0, 1),
        maxTokens: clamp(
            Math.round(toFiniteNumber(source.maxTokens) ?? DEFAULT_GENERATION.maxTokens),
            MIN_MAX_TOKENS,
            max
        ),
    };
}

export async function loadGenerationSettings(contextWindow?: number): Promise<GenerationSettings> {
    const json = await storageAdapter.getItem(GENERATION_SETTINGS_KEY);
    if (!json) return sanitizeGenerationSettings(DEFAULT_GENERATION, contextWindow);
    try {
        return sanitizeGenerationSettings(JSON.parse(json), contextWindow);
    } catch {
        return sanitizeGenerationSettings(DEFAULT_GENERATION, contextWindow);
    }
}

export async function saveGenerationSettings(
    settings: Partial<GenerationSettings>,
    contextWindow?: number
): Promise<GenerationSettings> {
    const normalized = sanitizeGenerationSettings(settings, contextWindow);
    await storageAdapter.setItem(GENERATION_SETTINGS_KEY, JSON.stringify(normalized));
    return normalized;
}

export async function resetGenerationSettings(contextWindow?: number): Promise<GenerationSettings> {
    const defaults = sanitizeGenerationSettings(DEFAULT_GENERATION, contextWindow);
    await storageAdapter.removeItem(GENERATION_SETTINGS_KEY);
    return defaults;
}

export function temperatureForImagination(value: unknown): number | undefined {
    const parsed = toFiniteNumber(value);
    if (parsed === undefined) return undefined;
    const imagination = clamp(parsed, 0, 100);
    if (imagination <= 33) return 0.3;
    if (imagination <= 66) return 0.7 + ((imagination - 34) / 32) * 0.3;
    return 1.5 + ((imagination - 67) / 33) * 0.5;
}

export function resolveGenerationSettings(
    base: Partial<GenerationSettings> = DEFAULT_GENERATION,
    flowOverride?: Partial<GenerationSettings>,
    personaImagination?: unknown,
    contextWindow?: number
): GenerationSettings {
    const merged = sanitizeGenerationSettings({ ...base, ...flowOverride }, contextWindow);
    const personaTemperature = temperatureForImagination(personaImagination);
    return personaTemperature === undefined
        ? merged
        : sanitizeGenerationSettings({ ...merged, temperature: personaTemperature }, contextWindow);
}
