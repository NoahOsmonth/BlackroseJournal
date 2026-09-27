/**
 * Direct OpenAI-compatible provider configuration.
 *
 * The app talks to exactly one thing: the OpenAI-compatible endpoint the user
 * configured. No vendor host, key or model id is baked into this module.
 *
 * These env vars are a **first-run seed only**. Expo inlines `EXPO_PUBLIC_*` at
 * build time, so they cannot change at runtime — the persisted provider profile
 * is the source of truth once the user saves one (see `customModels.ts`).
 *
 *   EXPO_PUBLIC_AI_CUSTOM_BASE         (optional; e.g. https://host/v1)
 *   EXPO_PUBLIC_AI_CUSTOM_API_KEY      (optional; seeded into the first profile)
 *   EXPO_PUBLIC_AI_CUSTOM_MODEL        (optional)
 *   EXPO_PUBLIC_AI_CUSTOM_FLASH_MODEL  (optional)
 *
 * All read at call time, not at module load.
 */

import { getActiveCustomModelConfig, type ContextWindowSource } from './customModels';

export interface DirectConfig {
    apiKey: string;
    apiBaseUrl: string;
    model: string;
    flashModel: string;
}

export interface ResolvedDirectConfig extends DirectConfig {
    source: 'env' | 'custom';
    contextWindow?: number;
    contextWindowSource?: ContextWindowSource;
    /** Ids to try if the selected model is rejected as missing. */
    fallbackModelIds?: readonly string[];
}

export class DirectConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DirectConfigError';
    }
}

function readVar(value: string | undefined): string | undefined {
    const trimmed = (value ?? '').trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

/** Placeholder values shipped in `.env.example` must never count as configured. */
function isPlaceholder(value: string): boolean {
    return /^YOUR_/i.test(value);
}

/** True when a real (non-placeholder) API key is seeded in the env. */
export function hasEnvDirectApiKey(): boolean {
    const apiKey = readVar(process.env.EXPO_PUBLIC_AI_CUSTOM_API_KEY);
    return Boolean(apiKey) && !isPlaceholder(apiKey ?? '');
}

function throwIfConfigResolutionAborted(signal?: AbortSignal): void {
    if (!signal?.aborted) return;
    const error = new Error('AI config resolution was cancelled by an account switch.');
    error.name = 'AbortError';
    throw error;
}

/**
 * Resolve the env-seeded provider. Throws when the seed is incomplete rather
 * than silently falling back to a host the user never chose.
 */
export function getDirectConfig(): DirectConfig {
    // Expo inlines EXPO_PUBLIC_* env vars at build time, so we must read
    // each one with a static key (no dynamic `process.env[key]`).
    const apiKey = readVar(process.env.EXPO_PUBLIC_AI_CUSTOM_API_KEY);
    const apiBaseUrl = readVar(process.env.EXPO_PUBLIC_AI_CUSTOM_BASE);
    const model = readVar(process.env.EXPO_PUBLIC_AI_CUSTOM_MODEL);
    const flashModel = readVar(process.env.EXPO_PUBLIC_AI_CUSTOM_FLASH_MODEL);

    if (!apiKey) {
        throw new DirectConfigError(
            'No AI provider is configured. Add a base URL, API key and model in Settings, '
            + 'or set EXPO_PUBLIC_AI_CUSTOM_BASE / EXPO_PUBLIC_AI_CUSTOM_API_KEY in .env.'
        );
    }
    if (isPlaceholder(apiKey)) {
        throw new DirectConfigError(
            `EXPO_PUBLIC_AI_CUSTOM_API_KEY is still a placeholder ("${apiKey}"). `
            + 'Replace it with a real key, or configure the provider in Settings.'
        );
    }
    if (!apiBaseUrl) {
        throw new DirectConfigError(
            'EXPO_PUBLIC_AI_CUSTOM_BASE is not set. Configure the provider in Settings.'
        );
    }
    if (!model) {
        throw new DirectConfigError(
            'EXPO_PUBLIC_AI_CUSTOM_MODEL is not set. Configure the provider in Settings.'
        );
    }

    return {
        apiKey,
        apiBaseUrl,
        model,
        flashModel: flashModel ?? model,
    };
}

export async function getResolvedDirectConfig(
    signal?: AbortSignal
): Promise<ResolvedDirectConfig> {
    throwIfConfigResolutionAborted(signal);
    const custom = await getActiveCustomModelConfig();
    throwIfConfigResolutionAborted(signal);
    if (custom) {
        return {
            apiKey: custom.apiKey,
            apiBaseUrl: custom.apiBaseUrl,
            model: custom.model,
            flashModel: custom.flashModel,
            source: 'custom',
            contextWindow: custom.contextWindow,
            contextWindowSource: custom.contextWindowSource,
            fallbackModelIds: custom.fallbackModelIds,
        };
    }

    const config = {
        ...getDirectConfig(),
        source: 'env' as const,
    };
    throwIfConfigResolutionAborted(signal);
    return config;
}
