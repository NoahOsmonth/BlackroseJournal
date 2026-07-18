/**
 * Probe-only env loader. Mirrors integration-test pattern.
 * Never hardcodes keys; reads process.env + project .env (gitignored).
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

export function applyProbeEnv(): {
    apiKey: string;
    apiBaseUrl: string;
    model: string;
    flashModel: string;
} {
    const fileEnv = readEnvFile();
    const apiKey = (
        process.env.EXPO_PUBLIC_NANO_GPT_API_KEY
        ?? fileEnv.EXPO_PUBLIC_NANO_GPT_API_KEY
        ?? ''
    ).trim();
    if (!apiKey || apiKey.includes('YOUR_')) {
        throw new Error(
            'Missing EXPO_PUBLIC_NANO_GPT_API_KEY for PROBE_LLM (set in .env; never commit).',
        );
    }
    const apiBaseUrl = (
        process.env.EXPO_PUBLIC_NANO_GPT_API_BASE_URL
        ?? fileEnv.EXPO_PUBLIC_NANO_GPT_API_BASE_URL
        ?? 'https://openrouter.ai/api/v1'
    ).replace(/\/+$/, '');
    const model = (
        process.env.EXPO_PUBLIC_NANO_GPT_MODEL
        ?? fileEnv.EXPO_PUBLIC_NANO_GPT_MODEL
        ?? 'tencent/hy3:free'
    ).trim();
    const flashModel = (
        process.env.EXPO_PUBLIC_NANO_GPT_FLASH_MODEL
        ?? fileEnv.EXPO_PUBLIC_NANO_GPT_FLASH_MODEL
        ?? model
    ).trim();

    process.env.EXPO_PUBLIC_NANO_GPT_API_KEY = apiKey;
    process.env.EXPO_PUBLIC_NANO_GPT_API_BASE_URL = apiBaseUrl;
    process.env.EXPO_PUBLIC_NANO_GPT_MODEL = model;
    process.env.EXPO_PUBLIC_NANO_GPT_FLASH_MODEL = flashModel;

    return { apiKey, apiBaseUrl, model, flashModel };
}

/** Live probe gate — same pattern as RUN_INTEGRATION_TESTS. */
export function probesEnabled(): boolean {
    return process.env.PROBE_LLM === '1';
}
