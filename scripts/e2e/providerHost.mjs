/**
 * The only outbound host the app is allowed to reach is the AI provider the
 * user configured. Derive it from the environment instead of hardcoding a host,
 * so these probes stay correct when the endpoint changes.
 *
 *   E2E_PROVIDER_HOST           explicit host[:port] to treat as the provider
 *   EXPO_PUBLIC_AI_CUSTOM_BASE  the app's configured base URL (fallback source)
 *
 * With neither set, `isProviderUrl` falls back to matching chat-completion
 * calls, which still fails loudly if the app reaches an unexpected host.
 */

import fs from 'fs';
import path from 'path';

export function readE2eEnvFile(cwd = process.cwd()) {
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
                if (index < 0) return [line, ''];
                let val = line.slice(index + 1).trim();
                if (
                    (val.startsWith('"') && val.endsWith('"'))
                    || (val.startsWith("'") && val.endsWith("'"))
                ) {
                    val = val.slice(1, -1);
                }
                return [line.slice(0, index).trim(), val];
            }),
    );
}

/** host[:port] of the configured provider, or null when nothing is configured. */
export function providerHost() {
    const explicit = (process.env.E2E_PROVIDER_HOST ?? '').trim();
    if (explicit) return explicit;

    const fileEnv = readE2eEnvFile();
    const base = (
        process.env.EXPO_PUBLIC_AI_CUSTOM_BASE
        ?? fileEnv.EXPO_PUBLIC_AI_CUSTOM_BASE
        ?? ''
    ).trim();
    if (!base) return null;
    try {
        return new URL(base).host;
    } catch {
        return null;
    }
}

/** True when `url` points at the configured provider. */
export function isProviderUrl(url) {
    const host = providerHost();
    if (host) return String(url).includes(`//${host}`);
    return /chat\/completions/.test(String(url));
}
