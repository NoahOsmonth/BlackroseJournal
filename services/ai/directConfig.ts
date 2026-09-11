/**
 * Direct OpenAI-compatible provider configuration.
 *
 * Reads the EXPO_PUBLIC_NANO_GPT_* env vars that the phone-side app needs
 * to talk to an OpenAI-compatible API without going through the local
 * Express backend. Naming is legacy; the only supported provider is the
 * local OmniRoute gateway (OpenAI-compatible).
 *
 * Env vars (all read at call time, not at module load):
 *   EXPO_PUBLIC_NANO_GPT_API_KEY       (required; OmniRoute data-plane key, stored locally for device builds)
 *   EXPO_PUBLIC_NANO_GPT_API_BASE_URL  (optional; defaults to the OmniRoute gateway)
 *   EXPO_PUBLIC_NANO_GPT_MODEL         (optional; defaults to merge/deepseek/deepseek-v4-flash-0731)
 *   EXPO_PUBLIC_NANO_GPT_FLASH_MODEL   (optional; defaults to merge/deepseek/deepseek-v4-flash-0731)
 */

import { DEFAULT_AI_BASE_URL } from '@/utils/ai/modelDisplay';
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
}

const DEFAULT_API_BASE_URL = DEFAULT_AI_BASE_URL;
const DEFAULT_MODEL = 'merge/deepseek/deepseek-v4-flash-0731';
const DEFAULT_FLASH_MODEL = 'merge/deepseek/deepseek-v4-flash-0731';
const PLACEHOLDER_KEYS = new Set([
    'YOUR_NANO_GPT_API_KEY',
    'YOUR_OMNIROUTE_DATA_PLANE_KEY',
]);

export class DirectConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DirectConfigError';
    }
}

function readVar(value: string | undefined): string | undefined {
    return value && value.length > 0 ? value : undefined;
}

/** True when a real (non-placeholder) direct API key is configured in the env. */
export function hasEnvDirectApiKey(): boolean {
    const apiKey = readVar(process.env.EXPO_PUBLIC_NANO_GPT_API_KEY);
    return Boolean(apiKey) && !PLACEHOLDER_KEYS.has(apiKey);
}

function throwIfConfigResolutionAborted(signal?: AbortSignal): void {
    if (!signal?.aborted) return;
    const error = new Error('AI config resolution was cancelled by an account switch.');
    error.name = 'AbortError';
    throw error;
}

export function getDirectConfig(): DirectConfig {
    // Expo inlines EXPO_PUBLIC_* env vars at build time, so we must read
    // each one with a static key (no dynamic `process.env[key]`).
    const apiKey = readVar(process.env.EXPO_PUBLIC_NANO_GPT_API_KEY);

    if (!apiKey) {
        throw new DirectConfigError(
            'Missing EXPO_PUBLIC_NANO_GPT_API_KEY. Set it in .env (OmniRoute gateway key recommended).'
        );
    }
    if (PLACEHOLDER_KEYS.has(apiKey)) {
        throw new DirectConfigError(
            `EXPO_PUBLIC_NANO_GPT_API_KEY is still a placeholder ("${apiKey}"). ` +
            'Replace it with a real OmniRoute data-plane key.'
        );
    }

    return {
        apiKey,
        apiBaseUrl: readVar(process.env.EXPO_PUBLIC_NANO_GPT_API_BASE_URL) ?? DEFAULT_API_BASE_URL,
        model: readVar(process.env.EXPO_PUBLIC_NANO_GPT_MODEL) ?? DEFAULT_MODEL,
        flashModel: readVar(process.env.EXPO_PUBLIC_NANO_GPT_FLASH_MODEL) ?? DEFAULT_FLASH_MODEL,
    };
}

export async function getResolvedDirectConfig(signal?: AbortSignal): Promise<ResolvedDirectConfig> {
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
        };
    }

    const config = {
        ...getDirectConfig(),
        source: 'env' as const,
    };
    throwIfConfigResolutionAborted(signal);
    return config;
}
