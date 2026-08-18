/**
 * Direct OpenAI-compatible provider configuration.
 *
 * Reads the EXPO_PUBLIC_NANO_GPT_* env vars that the phone-side app needs
 * to talk to an OpenAI-compatible API without going through the local
 * Express backend. Naming is legacy; recommended default is OpenRouter free.
 *
 * Env vars (all read at call time, not at module load):
 *   EXPO_PUBLIC_NANO_GPT_API_KEY       (required; stored locally for device builds)
 *   EXPO_PUBLIC_NANO_GPT_API_BASE_URL  (optional; defaults to OpenRouter)
 *   EXPO_PUBLIC_NANO_GPT_MODEL         (optional; defaults to dots-studio/dots-3-note-preview:free)
 *   EXPO_PUBLIC_NANO_GPT_FLASH_MODEL   (optional; defaults to dots-studio/dots-3-note-preview:free)
 */

import { OPENROUTER_DEFAULT_BASE_URL } from '@/utils/ai/modelDisplay';
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

const DEFAULT_API_BASE_URL = OPENROUTER_DEFAULT_BASE_URL;
const DEFAULT_MODEL = 'dots-studio/dots-3-note-preview:free';
const DEFAULT_FLASH_MODEL = 'dots-studio/dots-3-note-preview:free';
const PLACEHOLDER_KEYS = new Set([
    'YOUR_NANO_GPT_API_KEY',
    'YOUR_OPENROUTER_API_KEY',
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

export function getDirectConfig(): DirectConfig {
    // Expo inlines EXPO_PUBLIC_* env vars at build time, so we must read
    // each one with a static key (no dynamic `process.env[key]`).
    const apiKey = readVar(process.env.EXPO_PUBLIC_NANO_GPT_API_KEY);

    if (!apiKey) {
        throw new DirectConfigError(
            'Missing EXPO_PUBLIC_NANO_GPT_API_KEY. Set it in .env (OpenRouter free key recommended).'
        );
    }
    if (PLACEHOLDER_KEYS.has(apiKey)) {
        throw new DirectConfigError(
            `EXPO_PUBLIC_NANO_GPT_API_KEY is still a placeholder ("${apiKey}"). ` +
            'Replace it with a real OpenRouter or OpenAI-compatible key.'
        );
    }

    return {
        apiKey,
        apiBaseUrl: readVar(process.env.EXPO_PUBLIC_NANO_GPT_API_BASE_URL) ?? DEFAULT_API_BASE_URL,
        model: readVar(process.env.EXPO_PUBLIC_NANO_GPT_MODEL) ?? DEFAULT_MODEL,
        flashModel: readVar(process.env.EXPO_PUBLIC_NANO_GPT_FLASH_MODEL) ?? DEFAULT_FLASH_MODEL,
    };
}

export async function getResolvedDirectConfig(): Promise<ResolvedDirectConfig> {
    const custom = await getActiveCustomModelConfig();
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

    return {
        ...getDirectConfig(),
        source: 'env',
    };
}
