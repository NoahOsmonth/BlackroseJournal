/**
 * Hindsight client configuration (env-gated, soft-disable).
 * Reads EXPO_PUBLIC_HINDSIGHT_* at call time (Expo inlines static reads only).
 * No base URL configured -> Hindsight features are silently disabled.
 */

export interface HindsightConfig {
    baseUrl: string;
    apiKey?: string;
    bank: string;
    enabled: boolean;
}

const DEFAULT_BANK = 'rosebud';
const PLACEHOLDER_KEYS = new Set(['YOUR_HINDSIGHT_API_KEY']);

function readVar(value: string | undefined): string | undefined {
    return value && value.length > 0 ? value : undefined;
}

export function getHindsightConfig(): HindsightConfig {
    const rawBase = readVar(process.env.EXPO_PUBLIC_HINDSIGHT_BASE_URL);
    if (!rawBase) {
        return { baseUrl: '', enabled: false, bank: DEFAULT_BANK };
    }
    const apiKey = readVar(process.env.EXPO_PUBLIC_HINDSIGHT_API_KEY);
    return {
        baseUrl: rawBase.replace(/\/+$/, ''),
        apiKey: apiKey && !PLACEHOLDER_KEYS.has(apiKey) ? apiKey : undefined,
        bank: readVar(process.env.EXPO_PUBLIC_HINDSIGHT_BANK) ?? DEFAULT_BANK,
        enabled: true,
    };
}

export function isHindsightEnabled(): boolean {
    return getHindsightConfig().enabled;
}
