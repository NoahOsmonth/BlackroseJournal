import Constants from 'expo-constants';

export interface SupermemoryConfig {
    apiBaseUrl: string;
    apiKey: string;
}

type ExtraConfig = {
    SUPERMEMORY_API_KEY?: string;
    SUPERMEMORY_BASE_URL?: string;
    supermemoryApiKey?: string;
    supermemoryBaseUrl?: string;
};

const DEFAULT_API_BASE_URL = 'https://api.supermemory.ai';

function getExtraConfig(): ExtraConfig {
    const extra = {
        ...(Constants.manifest?.extra ?? {}),
        ...(Constants.expoGoConfig?.extra ?? {}),
        ...(Constants.expoConfig?.extra ?? {}),
    };

    return extra as ExtraConfig;
}

function readProcessEnv(key: string): string | undefined {
    if (typeof process === 'undefined' || !process.env) {
        return undefined;
    }

    return process.env[key];
}

export function getSupermemoryConfig(): SupermemoryConfig {
    const extra = getExtraConfig();
    const expoPublicApiKey =
        typeof process !== 'undefined'
            ? process.env.EXPO_PUBLIC_SUPERMEMORY_API_KEY
            : undefined;
    const expoPublicApiBaseUrl =
        typeof process !== 'undefined'
            ? process.env.EXPO_PUBLIC_SUPERMEMORY_BASE_URL
            : undefined;
    const apiKey =
        extra.SUPERMEMORY_API_KEY ||
        extra.supermemoryApiKey ||
        expoPublicApiKey ||
        readProcessEnv('SUPERMEMORY_API_KEY');

    if (!apiKey) {
        throw new Error('Missing Supermemory configuration: set SUPERMEMORY_API_KEY in your environment.');
    }

    const apiBaseUrl =
        extra.SUPERMEMORY_BASE_URL ||
        extra.supermemoryBaseUrl ||
        expoPublicApiBaseUrl ||
        readProcessEnv('SUPERMEMORY_BASE_URL') ||
        DEFAULT_API_BASE_URL;

    return { apiBaseUrl, apiKey };
}
