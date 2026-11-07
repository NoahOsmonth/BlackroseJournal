import {
    matchesModelFilter,
    pushRecentModelId,
    type ModelFilterPatterns,
} from '@/utils/ai/modelDisplay';
import { accountScopedStorage } from '@/services/account/accountScopedStorage';
import { runAccountBoundOperation } from '@/services/account/accountRuntime';

export type ContextWindowSource = 'api' | 'known' | 'fallback';

/**
 * Persisted schema version for the provider store.
 *
 * v1 — flat single provider (`baseUrl`/`apiKey`/`freeOnly` at the top level).
 * v2 — `profiles[]` + `activeProfileId`; no vendor host baked into the shape.
 * v3 — each profile records the provider *type* it was created as
 *      (`ProviderKind`), so the transport can shape requests for endpoints
 *      that only partly implement the OpenAI schema.
 *
 * Never change a stored shape without bumping this and extending
 * `migrateProviderSettings`.
 */
export const PROVIDER_SETTINGS_SCHEMA_VERSION = 3;

/**
 * Which OpenAI-compatible dialect a profile speaks.
 *
 * All three answer `POST {baseUrl}/chat/completions` with OpenAI-shaped bodies,
 * but they differ in what they accept:
 * - `openai`: the full schema (the default for any custom gateway).
 * - `google`: Gemini's compatibility layer; unlisted parameters are ignored
 *   rather than rejected.
 * - `anthropic`: Claude's compatibility layer, which caps `temperature` at 1,
 *   rejects `response_format: json_object`, and rejects a request that sets
 *   both `temperature` and `top_p`.
 *
 * This is a per-profile user choice, not host detection: the same gateway can
 * front several upstreams, and a user may proxy any of them.
 */
export type ProviderKind = 'openai' | 'google' | 'anthropic';

/** Pinned so the native Anthropic endpoints (model list) keep a stable shape. */
const ANTHROPIC_VERSION = '2023-06-01';

export function isProviderKind(value: unknown): value is ProviderKind {
    return value === 'openai' || value === 'google' || value === 'anthropic';
}

/**
 * What the add-provider picker offers, and the editable starting values each
 * choice fills in.
 *
 * These are *defaults for an editable field*, not a routing table: the base URL
 * is prefilled so the user does not have to find it in a vendor console, and
 * they can overwrite it with a proxy or gateway. Nothing here is consulted by
 * the transport — request shaping follows the profile's own `kind`.
 */
export interface ProviderKindOption {
    readonly kind: ProviderKind;
    readonly label: string;
    readonly description: string;
    readonly defaultBaseUrl: string;
    readonly defaultLabel: string;
    /** Where the user gets a key, shown as a hint under the access-key field. */
    readonly keyHint: string;
}

export const PROVIDER_KIND_OPTIONS: readonly ProviderKindOption[] = [
    {
        kind: 'openai',
        label: 'OpenAI compatible',
        description: 'Any service that works the way OpenAI does: your own gateway or proxy.',
        defaultBaseUrl: '',
        defaultLabel: 'AI service',
        keyHint: 'The access key your service expects.',
    },
    {
        kind: 'google',
        label: 'Google AI Studio',
        description: 'Gemini through Google AI Studio.',
        defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        defaultLabel: 'Google AI Studio',
        keyHint: 'Create a key at aistudio.google.com, then paste it here.',
    },
    {
        kind: 'anthropic',
        label: 'Anthropic',
        description: 'Claude through Anthropic.',
        defaultBaseUrl: 'https://api.anthropic.com/v1',
        defaultLabel: 'Anthropic',
        keyHint: 'Create a key at console.anthropic.com, then paste it here.',
    },
];

export function getProviderKindOption(kind: ProviderKind): ProviderKindOption {
    return PROVIDER_KIND_OPTIONS.find((option) => option.kind === kind)
        ?? PROVIDER_KIND_OPTIONS[0];
}

/** Upper bound on saved profiles — keeps one AsyncStorage value small. */
export const MAX_PROVIDER_PROFILES = 12;

export interface CustomAiModel {
    readonly id: string;
    readonly name?: string;
    readonly ownedBy?: string;
    readonly created?: number;
    readonly contextWindow: number;
    readonly contextWindowSource: ContextWindowSource;
}

/**
 * One configurable AI endpoint.
 *
 * Everything the transport needs lives here, so the app carries no vendor
 * host, key or model id in its build. A user can point the app at any
 * OpenAI-compatible gateway, and add a second one without retyping the first.
 */
export interface ProviderProfile {
    readonly id: string;
    readonly label: string;
    /**
     * Which OpenAI-compatible dialect this endpoint speaks. Chosen when the
     * provider is added; drives request shaping in the transport.
     */
    readonly kind: ProviderKind;
    readonly baseUrl: string;
    readonly apiKey: string;
    readonly selectedModelId: string | null;
    /** Used for cheap/short calls. Falls back to `selectedModelId` when null. */
    readonly flashModelId: string | null;
    readonly models: CustomAiModel[];
    readonly recentModelIds: readonly string[];
    /**
     * Case-insensitive substrings used to narrow the picker to a subset of the
     * endpoint's catalogue (e.g. `'gpt-4o'`, `'claude-'`). Empty = show all.
     * This is the user's own filter — the app ships no opinion about which
     * models are worth showing.
     */
    readonly modelFilterPatterns: readonly string[];
    /**
     * Ids to try when the selected model is rejected as missing. Empty means
     * "self-heal from this profile's own cached models only".
     */
    readonly fallbackModelIds: readonly string[];
    /** Per-profile override; null = trust the model's detected/known window. */
    readonly contextWindowOverride: number | null;
    readonly fallbackContextWindow: number;
    readonly createdAt: number;
    readonly updatedAt: number;
    readonly lastFetchedAt?: number;
    readonly lastFetchError?: string;
}

export interface CustomAiProviderSettings {
    readonly schemaVersion: number;
    readonly enabled: boolean;
    readonly activeProfileId: string;
    readonly profiles: ProviderProfile[];
    readonly updatedAt: number;
}

export interface ActiveCustomModelConfig {
    readonly profileId: string;
    readonly label: string;
    readonly kind: ProviderKind;
    readonly apiBaseUrl: string;
    readonly apiKey: string;
    readonly model: string;
    readonly flashModel: string;
    readonly contextWindow: number;
    readonly contextWindowSource: ContextWindowSource;
    readonly fallbackModelIds: readonly string[];
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

/**
 * Heuristic cache of well-known context windows, keyed by upstream model id.
 * Provider-agnostic: these are properties of the model, not of any gateway,
 * and every entry is only a shortcut past `fallbackContextWindow`.
 */
const KNOWN_CONTEXT_WINDOWS: Record<string, number> = {
    'nvidia/nemotron-3-ultra-550b-a55b': 1_000_000,
    'dots-studio/dots-3-note-preview': 512_000,
    'deepseek/deepseek-v4-flash': 128_000,
    'moonshotai/kimi-k2.5': 128_000,
    'moonshotai/kimi-k2.5:thinking': 128_000,
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

/** Subscribe to AI provider setting mutations (select/save/fetch/profile edits). */
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

/**
 * First-run seed for a fresh install. Expo inlines `EXPO_PUBLIC_*` at build
 * time, so these values can only ever *seed* the store — they are never read
 * as runtime configuration. Once the user saves a profile, the store is the
 * only source of provider truth.
 */
export function readEnvProviderSeed(): {
    baseUrl: string;
    apiKey: string;
    model?: string;
    flashModel?: string;
} {
    const read = (name: string): string => (process.env[name] ?? '').trim();
    return {
        baseUrl: read('EXPO_PUBLIC_AI_CUSTOM_BASE'),
        apiKey: read('EXPO_PUBLIC_AI_CUSTOM_API_KEY'),
        model: read('EXPO_PUBLIC_AI_CUSTOM_MODEL') || undefined,
        flashModel: read('EXPO_PUBLIC_AI_CUSTOM_FLASH_MODEL') || undefined,
    };
}

/** Placeholder keys shipped in `.env.example` must never count as configured. */
function isPlaceholderSecret(value: string): boolean {
    return /^YOUR_/i.test(value.trim());
}

export function generateProfileId(): string {
    return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createProviderProfile(
    overrides: Partial<ProviderProfile> = {}
): ProviderProfile {
    const now = Date.now();
    return {
        id: overrides.id ?? generateProfileId(),
        label: overrides.label ?? 'AI service',
        kind: overrides.kind ?? 'openai',
        baseUrl: overrides.baseUrl ?? '',
        apiKey: overrides.apiKey ?? '',
        selectedModelId: overrides.selectedModelId ?? null,
        flashModelId: overrides.flashModelId ?? null,
        models: overrides.models ? [...overrides.models] : [],
        recentModelIds: overrides.recentModelIds ? [...overrides.recentModelIds] : [],
        modelFilterPatterns: overrides.modelFilterPatterns
            ? [...overrides.modelFilterPatterns]
            : [],
        fallbackModelIds: overrides.fallbackModelIds ? [...overrides.fallbackModelIds] : [],
        contextWindowOverride: overrides.contextWindowOverride ?? null,
        fallbackContextWindow: normalizeFallbackContextWindow(
            overrides.fallbackContextWindow
        ),
        createdAt: overrides.createdAt ?? now,
        updatedAt: overrides.updatedAt ?? now,
        lastFetchedAt: overrides.lastFetchedAt,
        lastFetchError: overrides.lastFetchError,
    };
}

export function getDefaultCustomAiProviderSettings(): CustomAiProviderSettings {
    const seed = readEnvProviderSeed();
    const seededKey = seed.apiKey && !isPlaceholderSecret(seed.apiKey) ? seed.apiKey : '';
    const profile = createProviderProfile({
        label: seed.baseUrl ? 'Default AI service' : 'AI service',
        baseUrl: seed.baseUrl,
        apiKey: seededKey,
        selectedModelId: seed.model ?? null,
        flashModelId: seed.flashModel ?? null,
    });
    return {
        schemaVersion: PROVIDER_SETTINGS_SCHEMA_VERSION,
        enabled: false,
        activeProfileId: profile.id,
        profiles: [profile],
        updatedAt: 0,
    };
}

export function getActiveProfile(
    settings: CustomAiProviderSettings
): ProviderProfile | null {
    return settings.profiles.find((profile) => profile.id === settings.activeProfileId)
        ?? settings.profiles[0]
        ?? null;
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
    if (!trimmed) throw new CustomModelSettingsError('Address is required.');

    let parsed: URL;
    try {
        parsed = new URL(trimmed);
    } catch {
        throw new CustomModelSettingsError('Address must be a full web address.');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new CustomModelSettingsError('Address must start with http:// or https://.');
    }

    if (parsed.pathname === '' || parsed.pathname === '/') {
        parsed.pathname = '/v1';
    }

    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
}

function normalizeApiKey(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) throw new CustomModelSettingsError('Access key is required.');
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

function sanitizeStoredModel(
    record: unknown,
    fallbackContextWindow: number
): CustomAiModel | null {
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
        throw new CustomModelSettingsError('The AI service sent a list the app couldn’t read.');
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

function sanitizeStringList(value: unknown, limit: number): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim())
        .slice(0, limit);
}

function sanitizeProfile(value: unknown, index: number): ProviderProfile | null {
    if (!isRecord(value)) return null;

    const fallbackContextWindow = normalizeFallbackContextWindow(value.fallbackContextWindow);
    const id = typeof value.id === 'string' && value.id.trim()
        ? value.id.trim()
        : generateProfileId();
    const label = typeof value.label === 'string' && value.label.trim()
        ? value.label.trim()
        : `AI service ${index + 1}`;
    const loadedModels = sanitizeModels(value.models, fallbackContextWindow);

    // A selection the freshly fetched catalogue does not list is kept, and so is
    // a stand-in entry for it: the address can serve more than it advertises,
    // and silently forgetting the choice is worse than showing it (DEF-030).
    const selectedRaw = typeof value.selectedModelId === 'string' && value.selectedModelId.trim()
        ? value.selectedModelId.trim()
        : null;
    const models = selectedRaw && !loadedModels.some((m) => m.id === selectedRaw)
        ? [
            {
                id: selectedRaw,
                name: selectedRaw,
                ownedBy: 'chosen',
                created: 0,
                contextWindow: fallbackContextWindow,
                contextWindowSource: 'fallback' as const,
            },
            ...loadedModels,
        ]
        : loadedModels;
    const selectedModelId = selectedRaw;
    const flashRaw = typeof value.flashModelId === 'string' ? value.flashModelId : null;
    const flashModelId = flashRaw && models.some((m) => m.id === flashRaw) ? flashRaw : null;

    const override = toPositiveInteger(value.contextWindowOverride);

    return {
        id,
        label,
        // v2 profiles predate the provider-type choice and were all plain
        // OpenAI-compatible gateways, so that is the only safe default.
        kind: isProviderKind(value.kind) ? value.kind : 'openai',
        baseUrl: typeof value.baseUrl === 'string' ? value.baseUrl.trim() : '',
        apiKey: typeof value.apiKey === 'string' ? value.apiKey : '',
        selectedModelId,
        flashModelId,
        models,
        recentModelIds: sanitizeRecentIds(value.recentModelIds),
        modelFilterPatterns: sanitizeStringList(value.modelFilterPatterns, 12),
        fallbackModelIds: sanitizeStringList(value.fallbackModelIds, 12),
        contextWindowOverride: override ? normalizeFallbackContextWindow(override) : null,
        fallbackContextWindow,
        createdAt: toPositiveInteger(value.createdAt) ?? Date.now(),
        updatedAt: toPositiveInteger(value.updatedAt) ?? Date.now(),
        lastFetchedAt: toPositiveInteger(value.lastFetchedAt),
        lastFetchError: typeof value.lastFetchError === 'string'
            ? value.lastFetchError
            : undefined,
    };
}

/**
 * Fold a v1 flat record (`baseUrl`/`apiKey`/`freeOnly`/`models` at the top
 * level) into a single v2 profile. This is the only place v1 is understood.
 */
function migrateV1ToV2(value: ModelRecord): CustomAiProviderSettings {
    const fallbackContextWindow = normalizeFallbackContextWindow(value.fallbackContextWindow);
    const models = sanitizeModels(value.models, fallbackContextWindow);
    const selectedRaw = typeof value.selectedModelId === 'string' ? value.selectedModelId : null;
    const updatedAt = toPositiveInteger(value.updatedAt) ?? Date.now();

    const profile = createProviderProfile({
        label: 'AI service',
        baseUrl: typeof value.baseUrl === 'string' ? value.baseUrl.trim() : '',
        apiKey: typeof value.apiKey === 'string' ? value.apiKey : '',
        selectedModelId: selectedRaw && models.some((m) => m.id === selectedRaw)
            ? selectedRaw
            : null,
        models,
        recentModelIds: sanitizeRecentIds(value.recentModelIds),
        fallbackContextWindow,
        createdAt: updatedAt,
        updatedAt,
        lastFetchedAt: toPositiveInteger(value.lastFetchedAt),
        lastFetchError: typeof value.lastFetchError === 'string'
            ? value.lastFetchError
            : undefined,
    });

    // v1's `freeOnly` flag is intentionally NOT carried over as a policy — the
    // concept is gone. `freeOnly: true` becomes an equivalent `:free` picker
    // filter, so the user keeps the view they had without the app holding a
    // pricing opinion or blocking model ids.
    const migrated: ProviderProfile = value.freeOnly === true
        ? { ...profile, modelFilterPatterns: [':free'] }
        : profile;

    return {
        schemaVersion: PROVIDER_SETTINGS_SCHEMA_VERSION,
        enabled: value.enabled === true,
        activeProfileId: migrated.id,
        profiles: [migrated],
        updatedAt,
    };
}

export function migrateProviderSettings(value: unknown): CustomAiProviderSettings {
    const defaults = getDefaultCustomAiProviderSettings();
    if (!isRecord(value)) return defaults;

    const rawProfiles = Array.isArray(value.profiles) ? value.profiles : null;

    // No `profiles[]` at all: a v1 flat payload, or a profile-store record that
    // lost its profiles. Only a top-level baseUrl/apiKey means v1 — anything
    // else is unreadable and falls back to defaults.
    if (!rawProfiles) {
        if (typeof value.baseUrl === 'string' || typeof value.apiKey === 'string') {
            return migrateV1ToV2(value);
        }
        return defaults;
    }

    // A v2 record reaches here too: `sanitizeProfile` fills in the fields v2
    // did not store (v3's `kind` defaults to 'openai'), so an older payload is
    // upgraded in place rather than discarded.
    const profiles = rawProfiles
        .map((profile, index) => sanitizeProfile(profile, index))
        .filter((profile): profile is ProviderProfile => profile !== null)
        .slice(0, MAX_PROVIDER_PROFILES);

    if (profiles.length === 0) return defaults;

    const activeProfileId = typeof value.activeProfileId === 'string'
        && profiles.some((profile) => profile.id === value.activeProfileId)
        ? value.activeProfileId
        : profiles[0].id;

    return {
        schemaVersion: PROVIDER_SETTINGS_SCHEMA_VERSION,
        enabled: value.enabled === true,
        activeProfileId,
        profiles,
        updatedAt: toPositiveInteger(value.updatedAt) ?? 0,
    };
}

export async function loadCustomAiProviderSettings(): Promise<CustomAiProviderSettings> {
    return runAccountBoundOperation('custom-ai-settings-read', async () => {
        const json = await storageAdapter.getItem(CUSTOM_AI_SETTINGS_KEY);
        if (!json) return getDefaultCustomAiProviderSettings();
        try {
            return migrateProviderSettings(JSON.parse(json));
        } catch {
            return getDefaultCustomAiProviderSettings();
        }
    });
}

export async function saveCustomAiProviderSettings(
    settings: CustomAiProviderSettings
): Promise<CustomAiProviderSettings> {
    return withSettingsMutation(async () => {
        const normalized = migrateProviderSettings({ ...settings, updatedAt: Date.now() });
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

/**
 * Auth headers for the model *list* endpoint.
 *
 * Chat completions and `/models` do not share an auth story on Anthropic's
 * compatibility layer: `POST /v1/chat/completions` accepts
 * `Authorization: Bearer`, but `GET /v1/models` is the native endpoint and
 * reads `x-api-key` only — a Bearer-only request there answers 401
 * "x-api-key header is required". So the list call needs the native headers
 * for that kind, and every other kind keeps the plain Bearer form.
 */
function modelListAuthHeaders(
    kind: ProviderKind,
    apiKey: string,
): Record<string, string> {
    if (kind === 'anthropic') {
        return {
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
        };
    }
    return { Authorization: `Bearer ${apiKey}` };
}

export async function fetchOpenAiCompatibleModels(input: {
    readonly baseUrl: string;
    readonly apiKey: string;
    readonly kind?: ProviderKind;
    readonly fallbackContextWindow?: number;
    readonly modelFilterPatterns?: ModelFilterPatterns;
    readonly signal?: AbortSignal;
}): Promise<{
    readonly baseUrl: string;
    readonly models: CustomAiModel[];
    readonly fetchedAt: number;
}> {
    const baseUrl = normalizeOpenAiBaseUrl(input.baseUrl);
    const apiKey = normalizeApiKey(input.apiKey);
    const patterns = input.modelFilterPatterns ?? [];
    const response = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            ...modelListAuthHeaders(input.kind ?? 'openai', apiKey),
        },
        ...(input.signal ? { signal: input.signal } : {}),
    }).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'The connection failed.';
        throw new CustomModelSettingsError(`Could not reach your AI service. ${message}`);
    });

    if (!response.ok) {
        throw new CustomModelSettingsError(
            `Your AI service returned an error (${response.status}). `
            + 'Check the address and access key in Settings → AI.'
        );
    }

    const json = await response.json().catch(() => {
        throw new CustomModelSettingsError('Your AI service sent something the app couldn’t read.');
    });

    const models = parseOpenAiCompatibleModels(json, input.fallbackContextWindow)
        .filter((model) => matchesModelFilter(model.id, patterns));

    if (models.length === 0) {
        throw new CustomModelSettingsError(
            patterns.length > 0
                ? 'No AI options matched your filter words. Change them in Settings.'
                : 'No usable AI options were returned.'
        );
    }

    return { baseUrl, models, fetchedAt: Date.now() };
}

export function withSelectedModel(
    profile: ProviderProfile,
    modelId: string
): ProviderProfile {
    const selected = profile.models.find((model) => model.id === modelId);
    if (!selected) {
        throw new CustomModelSettingsError('That AI option isn’t available.');
    }
    return {
        ...profile,
        selectedModelId: modelId,
        recentModelIds: pushRecentModelId(profile.recentModelIds, modelId),
        updatedAt: Date.now(),
    };
}

export function pickModelAfterFetch(
    models: readonly CustomAiModel[],
    previousSelectedId: string | null,
    preferredEnvModel?: string
): string | null {
    const ids = new Set(models.map((model) => model.id));
    // A chosen AI survives a refresh even when the address lists a narrower
    // catalogue than it serves (gateways often do). Dropping the choice here
    // sent writers back to "Choose AI" with no explanation (DEF-030).
    if (previousSelectedId) return previousSelectedId;
    if (preferredEnvModel && ids.has(preferredEnvModel)) return preferredEnvModel;
    return models[0]?.id ?? null;
}

/**
 * Build a model entry from a hand-typed id (escape hatch when the endpoint's
 * `/models` response can't be fetched or parsed). Context window is the
 * fallback value; it is never marked as API-detected.
 */
export function buildManualModel(id: string, fallbackContextWindow: number): CustomAiModel {
    const normalizedId = id.trim();
    if (!normalizedId) throw new CustomModelSettingsError('An option name is required.');
    return {
        id: normalizedId,
        contextWindow: normalizeFallbackContextWindow(fallbackContextWindow),
        contextWindowSource: 'fallback',
    };
}

/** Add (or refresh) a manually-entered model and select it on the profile. */
export function withManualModel(
    profile: ProviderProfile,
    id: string,
    fallbackContextWindow: number
): ProviderProfile {
    const model = buildManualModel(id, fallbackContextWindow);
    const exists = profile.models.some((entry) => entry.id === model.id);
    const models = exists
        ? profile.models.map((entry) => (entry.id === model.id
            ? { ...entry, ...model, name: entry.name, ownedBy: entry.ownedBy }
            : entry))
        : [...profile.models, model];
    return {
        ...profile,
        models,
        selectedModelId: model.id,
        recentModelIds: pushRecentModelId(profile.recentModelIds, model.id),
        updatedAt: Date.now(),
    };
}

/** Replace one profile in a settings object, leaving its siblings intact. */
export function withUpdatedProfile(
    settings: CustomAiProviderSettings,
    profile: ProviderProfile
): CustomAiProviderSettings {
    return {
        ...settings,
        profiles: settings.profiles.map((entry) => (
            entry.id === profile.id ? profile : entry
        )),
        updatedAt: Date.now(),
    };
}

export function addProviderProfile(
    settings: CustomAiProviderSettings,
    profile: ProviderProfile
): CustomAiProviderSettings {
    if (settings.profiles.length >= MAX_PROVIDER_PROFILES) {
        throw new CustomModelSettingsError(
            `You can save up to ${MAX_PROVIDER_PROFILES} AI services. Remove one first.`
        );
    }
    return {
        ...settings,
        activeProfileId: profile.id,
        profiles: [...settings.profiles, profile],
        updatedAt: Date.now(),
    };
}

export function removeProviderProfile(
    settings: CustomAiProviderSettings,
    profileId: string
): CustomAiProviderSettings {
    const profiles = settings.profiles.filter((profile) => profile.id !== profileId);
    if (profiles.length === 0) {
        throw new CustomModelSettingsError('Keep at least one AI service.');
    }
    return {
        ...settings,
        profiles,
        activeProfileId: settings.activeProfileId === profileId
            ? profiles[0].id
            : settings.activeProfileId,
        updatedAt: Date.now(),
    };
}

export function setActiveProfile(
    settings: CustomAiProviderSettings,
    profileId: string
): CustomAiProviderSettings {
    if (!settings.profiles.some((profile) => profile.id === profileId)) {
        throw new CustomModelSettingsError('AI service not found.');
    }
    return { ...settings, activeProfileId: profileId, updatedAt: Date.now() };
}

export async function getActiveCustomModelConfig(): Promise<ActiveCustomModelConfig | null> {
    const settings = await loadCustomAiProviderSettings();
    if (!settings.enabled) return null;

    const profile = getActiveProfile(settings);
    if (!profile) return null;

    const apiBaseUrl = normalizeOpenAiBaseUrl(profile.baseUrl);
    const apiKey = normalizeApiKey(profile.apiKey);
    const selected = profile.models.find((model) => model.id === profile.selectedModelId);
    if (!selected) {
        throw new CustomModelSettingsError('An AI service is on but no AI option is chosen.');
    }

    const contextWindow = profile.contextWindowOverride ?? selected.contextWindow;
    const contextWindowSource: ContextWindowSource = profile.contextWindowOverride
        ? 'fallback'
        : selected.contextWindowSource;

    return {
        profileId: profile.id,
        label: profile.label,
        kind: profile.kind,
        apiBaseUrl,
        apiKey,
        model: selected.id,
        flashModel: profile.flashModelId ?? selected.id,
        contextWindow,
        contextWindowSource,
        fallbackModelIds: profile.fallbackModelIds,
    };
}
