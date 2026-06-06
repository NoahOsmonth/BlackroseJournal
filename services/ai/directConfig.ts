/**
 * Direct-to-NanoGPT configuration.
 *
 * Reads the EXPO_PUBLIC_NANO_GPT_* env vars that the phone-side app needs
 * to talk to NanoGPT's OpenAI-compatible API without going through the
 * local Express backend. This file stages the new code path; commit 3
 * will flip consumers (streamingTransports, insights, askRosebud) over
 * to it. Until then, the agent layer remains the active path.
 *
 * Env vars (all read at call time, not at module load):
 *   EXPO_PUBLIC_NANO_GPT_API_KEY       (required; throws if missing/placeholder)
 *   EXPO_PUBLIC_NANO_GPT_API_BASE_URL  (optional; defaults to https://nano-gpt.com/api/v1)
 *   EXPO_PUBLIC_NANO_GPT_MODEL         (optional; defaults to moonshotai/kimi-k2.5:thinking)
 *   EXPO_PUBLIC_NANO_GPT_FLASH_MODEL   (optional; defaults to moonshotai/kimi-k2.5)
 */

export interface DirectConfig {
    apiKey: string;
    apiBaseUrl: string;
    model: string;
    flashModel: string;
}

const DEFAULT_API_BASE_URL = 'https://nano-gpt.com/api/v1';
const DEFAULT_MODEL = 'moonshotai/kimi-k2.5:thinking';
const DEFAULT_FLASH_MODEL = 'moonshotai/kimi-k2.5';
const PLACEHOLDER_API_KEY = 'YOUR_NANO_GPT_API_KEY';

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
            'Missing EXPO_PUBLIC_NANO_GPT_API_KEY. Set it in .env to talk to NanoGPT directly.'
        );
    }
    if (apiKey === PLACEHOLDER_API_KEY) {
        throw new DirectConfigError(
            `EXPO_PUBLIC_NANO_GPT_API_KEY is the placeholder value "${PLACEHOLDER_API_KEY}". Replace it with a real key.`
        );
    }

    return {
        apiKey,
        apiBaseUrl: readVar(process.env.EXPO_PUBLIC_NANO_GPT_API_BASE_URL) ?? DEFAULT_API_BASE_URL,
        model: readVar(process.env.EXPO_PUBLIC_NANO_GPT_MODEL) ?? DEFAULT_MODEL,
        flashModel: readVar(process.env.EXPO_PUBLIC_NANO_GPT_FLASH_MODEL) ?? DEFAULT_FLASH_MODEL,
    };
}
