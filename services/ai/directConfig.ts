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
    /**
     * Typed marker so retry helpers can recognise a configuration error without
     * relying on `instanceof` across module realms / bundles.
     */
    readonly isDirectConfigError = true;

    constructor(message: string) {
        super(message);
        this.name = 'DirectConfigError';
    }
}

/**
 * True for a provider-configuration error. This class is thrown purely from
 * reading env/settings, *before any transport exists* — so it is a permanent
 * condition that cannot succeed on retry. Retry helpers must fail fast on it
 * rather than backing off like a transient network blip (same precedent as
 * `fetchDirectJsonCompletion`, which only freeform-retries on 400/422).
 */
export function isDirectConfigError(error: unknown): error is DirectConfigError {
    if (error instanceof DirectConfigError) return true;
    return (
        typeof error === 'object'
        && error !== null
        && (error as { isDirectConfigError?: unknown }).isDirectConfigError === true
    );
}

/** Config messages already surfaced this process. */
const warnedDirectConfigMessages = new Set<string>();

/**
 * Surface a configuration error ONCE, reusing its own actionable message
 * (Settings / env vars). One finish turn can hit the same misconfiguration from
 * several steps; this collapses them to a single line instead of six. The set
 * clears whenever a config resolution succeeds, so a later regression warns
 * again.
 */
export function warnDirectConfigErrorOnce(error: unknown): void {
    if (!isDirectConfigError(error)) return;
    const message = error instanceof Error && error.message
        ? error.message
        : String(error);
    if (warnedDirectConfigMessages.has(message)) return;
    warnedDirectConfigMessages.add(message);
    console.warn(message);
}

/** Test seam: forget which configuration messages have been warned. */
export function resetDirectConfigWarningForTests(): void {
    warnedDirectConfigMessages.clear();
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

    // Config resolved cleanly — forget past warnings so a later regression
    // (user clears the provider again) is reported afresh.
    warnedDirectConfigMessages.clear();

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
