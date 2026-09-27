/**
 * Full model roster/config as used by the app — assembled for probe artifacts.
 * Source files: services/ai/customModels.ts (provider store + KNOWN_CONTEXT_WINDOWS),
 * services/ai/directConfig.ts, utils/ai/modelDisplay.ts, utils/ai/modelFallback.ts.
 *
 * There is no vendor roster. The app ships no base URL, no preferred model id
 * and no built-in fallback model list — everything below is either a value the
 * user configured or a heuristic.
 */

export const ROSTER_VERBATIM = {
    source: 'BlackroseJournal app AI model roster (design probe artifact)',
    capturedFrom: [
        'services/ai/customModels.ts',
        'services/ai/directConfig.ts',
        'utils/ai/modelDisplay.ts',
        'utils/ai/modelFallback.ts',
    ],
    envKeys: {
        EXPO_PUBLIC_AI_CUSTOM_API_KEY: '(from .env / process.env — never committed; first-run seed only)',
        EXPO_PUBLIC_AI_CUSTOM_BASE: 'optional; no default — user-configured',
        EXPO_PUBLIC_AI_CUSTOM_MODEL: 'optional; no default',
        EXPO_PUBLIC_AI_CUSTOM_FLASH_MODEL: 'optional; falls back to the selected model',
    },
    providerStore: {
        storageKey: '@blackrose_custom_ai_provider',
        schemaVersion: 2,
        shape: 'profiles[] + activeProfileId (a flat single-provider v1 record migrates on load)',
        maxProfiles: 12,
        perProfileFields: [
            'label',
            'baseUrl',
            'apiKey',
            'selectedModelId',
            'flashModelId',
            'models',
            'recentModelIds',
            'modelFilterPatterns',
            'fallbackModelIds',
            'contextWindowOverride',
            'fallbackContextWindow',
        ],
    },
    vendorDefaults: 'none — no base URL, model id or fallback list is hardcoded',
    modelFilter: {
        mechanism: 'per-profile case-insensitive substring patterns',
        emptyMeans: 'show every model the endpoint returns',
        note: 'the app holds no opinion about which models are worth showing',
    },
    selfHeal: {
        pool: 'declared fallbackModelIds -> cached models -> recent models -> configured model',
        builtinFallbacks: 'none',
    },
    knownContextWindows: {
        'nvidia/nemotron-3-ultra-550b-a55b': 1_000_000,
        'dots-studio/dots-3-note-preview': 512_000,
        'deepseek/deepseek-v4-flash': 128_000,
        'moonshotai/kimi-k2.5': 128_000,
        'moonshotai/kimi-k2.5:thinking': 128_000,
    } as const,
    defaultFallbackContextWindow: 128_000,
} as const;

export function formatRosterArtifact(): string {
    return JSON.stringify(ROSTER_VERBATIM, null, 2);
}

/**
 * Probe model selection. There is no built-in roster — the probes run against
 * whatever the configured provider serves, so the ids come from the same env
 * the app seeds from. This throws rather than returning an empty list, because
 * an empty selection reads exactly like "probe ran, found nothing".
 */
export function resolveProbeSelection(): {
    e1: string[];
    e2: string[];
    flashRequired: string;
} {
    const read = (key: string) => (process.env[key] ?? '').trim();
    const primary = read('EXPO_PUBLIC_AI_CUSTOM_MODEL');
    if (!primary) {
        throw new Error(
            'EXPO_PUBLIC_AI_CUSTOM_MODEL is required — the probes carry no built-in model roster.'
        );
    }
    const extras = read('PROBE_EXTRA_MODELS')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
    const flash = read('EXPO_PUBLIC_AI_CUSTOM_FLASH_MODEL') || primary;
    return { e1: [primary, ...extras], e2: [primary, ...extras], flashRequired: flash };
}
