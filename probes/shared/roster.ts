/**
 * Full model roster/config as used by the app — assembled for probe artifacts.
 * Source files: constants/aiModels.ts, services/ai/directConfig.ts,
 * services/ai/customModels.ts KNOWN_CONTEXT_WINDOWS, utils/ai/modelFallback.ts,
 * utils/ai/modelDisplay.ts.
 */

export const ROSTER_VERBATIM = {
    source: 'BlackroseJournal app AI model roster (design probe artifact)',
    capturedFrom: [
        'constants/aiModels.ts',
        'services/ai/directConfig.ts',
        'services/ai/customModels.ts',
        'utils/ai/modelDisplay.ts',
        'utils/ai/modelFallback.ts',
        'backend/src/config/aiConfig.ts',
    ],
    envKeys: {
        EXPO_PUBLIC_NANO_GPT_API_KEY: '(from .env / process.env — never committed)',
        EXPO_PUBLIC_NANO_GPT_API_BASE_URL: 'optional; default http://100.107.7.52:20128/v1',
        EXPO_PUBLIC_NANO_GPT_MODEL: 'optional; default merge/deepseek/deepseek-v4-flash-0731',
        EXPO_PUBLIC_NANO_GPT_FLASH_MODEL: 'optional; default merge/deepseek/deepseek-v4-flash-0731',
    },
    directConfigDefaults: {
        DEFAULT_API_BASE_URL: 'http://100.107.7.52:20128/v1',
        DEFAULT_MODEL: 'merge/deepseek/deepseek-v4-flash-0731',
        DEFAULT_FLASH_MODEL: 'merge/deepseek/deepseek-v4-flash-0731',
    },
    preferredFreeModelId: 'merge/deepseek/deepseek-v4-flash-0731',
    openrouterDefaultBaseUrl: 'https://openrouter.ai/api/v1',
    personaModels: [
        'nvidia/nemotron-3-ultra-550b-a55b',
        'moonshotai/kimi-k2.5:thinking',
        'moonshotai/kimi-k2.5',
    ] as const,
    personaModelLabels: {
        'nvidia/nemotron-3-ultra-550b-a55b': 'NVIDIA Nemotron 3 Ultra 550B',
        'moonshotai/kimi-k2.5:thinking': 'Kimi K2.5 Thinking',
        'moonshotai/kimi-k2.5': 'Kimi K2.5',
    } as const,
    defaultPersonaModel: 'nvidia/nemotron-3-ultra-550b-a55b',
    knownContextWindows: {
        'nvidia/nemotron-3-ultra-550b-a55b': 1_000_000,
        'nvidia/nemotron-3-ultra-550b-a55b:free': 1_000_000,
        'dots-studio/dots-3-note-preview:free': 512_000,
        'cl/dots-studio/dots-3-note-preview:free': 128_000,
        'merge/deepseek/deepseek-v4-flash-0731': 128_000,
        'moonshotai/kimi-k2.5:thinking': 128_000,
        'moonshotai/kimi-k2.5': 128_000,
    } as const,
    defaultFallbackContextWindow: 128_000,
    builtinFreeFallbackModels: [
        'cl/tencent/hy3:free',
        'nvidia/nemotron-3-ultra-550b-a55b:free',
    ] as const,
    backendDefaults: {
        DEFAULT_MODEL: 'nvidia/nemotron-3-ultra-550b-a55b',
        note: 'Backend optional; device-direct is source of truth for freeform.',
    },
    freeOnlyPolicy: {
        default: true,
        freeIdRule: "id includes ':free' OR id === 'openrouter/free'",
    },
    /** Models selected for live probes (must include flash). */
    probeSelection: {
        e1: [
            'merge/deepseek/deepseek-v4-flash-0731',
            'nvidia/nemotron-3-ultra-550b-a55b:free',
            'openrouter/free',
        ],
        e2: [
            'merge/deepseek/deepseek-v4-flash-0731',
            'nvidia/nemotron-3-ultra-550b-a55b:free',
            'openrouter/free',
            'moonshotai/kimi-k2.5',
        ],
        flashRequired: 'merge/deepseek/deepseek-v4-flash-0731',
    },
} as const;

export function formatRosterArtifact(): string {
    return JSON.stringify(ROSTER_VERBATIM, null, 2);
}
