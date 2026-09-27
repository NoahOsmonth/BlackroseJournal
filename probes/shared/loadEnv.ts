/**
 * Probe-only env loader. Mirrors integration-test pattern.
 * Never hardcodes keys or hosts; reads process.env + project .env (gitignored).
 */

import fs from 'fs';
import path from 'path';

export function readEnvFile(cwd = process.cwd()): Record<string, string> {
    const envPath = path.join(cwd, '.env');
    if (!fs.existsSync(envPath)) return {};
    const text = fs.readFileSync(envPath, 'utf-8');
    return Object.fromEntries(
        text
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith('#'))
            .map((line) => {
                const index = line.indexOf('=');
                if (index < 0) return [line, ''] as const;
                let val = line.slice(index + 1).trim();
                if (
                    (val.startsWith('"') && val.endsWith('"'))
                    || (val.startsWith("'") && val.endsWith("'"))
                ) {
                    val = val.slice(1, -1);
                }
                return [line.slice(0, index).trim(), val] as const;
            }),
    );
}

const ENV_KEYS = {
    apiKey: 'EXPO_PUBLIC_AI_CUSTOM_API_KEY',
    apiBaseUrl: 'EXPO_PUBLIC_AI_CUSTOM_BASE',
    model: 'EXPO_PUBLIC_AI_CUSTOM_MODEL',
    flashModel: 'EXPO_PUBLIC_AI_CUSTOM_FLASH_MODEL',
} as const;

export function applyProbeEnv(): {
    apiKey: string;
    apiBaseUrl: string;
    model: string;
    flashModel: string;
} {
    const fileEnv = readEnvFile();
    const read = (key: string): string => (
        process.env[key] ?? fileEnv[key] ?? ''
    ).trim();

    const apiKey = read(ENV_KEYS.apiKey);
    if (!apiKey || apiKey.includes('YOUR_')) {
        throw new Error(
            `Missing ${ENV_KEYS.apiKey} for PROBE_LLM (set in .env; never commit).`,
        );
    }
    const apiBaseUrl = read(ENV_KEYS.apiBaseUrl).replace(/\/+$/, '');
    if (!apiBaseUrl) {
        throw new Error(
            `Missing ${ENV_KEYS.apiBaseUrl} for PROBE_LLM. `
            + 'Point it at the OpenAI-compatible endpoint you want to probe.',
        );
    }
    const model = read(ENV_KEYS.model);
    if (!model) {
        throw new Error(`Missing ${ENV_KEYS.model} for PROBE_LLM.`);
    }
    const flashModel = read(ENV_KEYS.flashModel) || model;

    process.env[ENV_KEYS.apiKey] = apiKey;
    process.env[ENV_KEYS.apiBaseUrl] = apiBaseUrl;
    process.env[ENV_KEYS.model] = model;
    process.env[ENV_KEYS.flashModel] = flashModel;

    return { apiKey, apiBaseUrl, model, flashModel };
}

/** Live probe gate — same pattern as RUN_INTEGRATION_TESTS. */
export function probesEnabled(): boolean {
    return process.env.PROBE_LLM === '1';
}
