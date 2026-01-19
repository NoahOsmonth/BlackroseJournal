import Constants from 'expo-constants';

export interface AiConfig {
    apiBaseUrl: string;
    apiKey: string;
    model: string;
}

type ExtraConfig = {
    NANO_GPT_API_KEY?: string;
    NANO_GPT_API_BASE_URL?: string;
    NANO_GPT_MODEL?: string;
    nanoGptApiKey?: string;
    nanoGptApiBaseUrl?: string;
    nanoGptModel?: string;
};

const DEFAULT_API_BASE_URL = 'https://nano-gpt.com/api/v1';
const DEFAULT_MODEL = 'zai-org/glm-4.7-original:thinking';

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

export function getAiConfig(): AiConfig {
    const extra = getExtraConfig();
    const expoPublicApiKey =
        typeof process !== 'undefined'
            ? process.env.EXPO_PUBLIC_NANO_GPT_API_KEY
            : undefined;
    const expoPublicApiBaseUrl =
        typeof process !== 'undefined'
            ? process.env.EXPO_PUBLIC_NANO_GPT_API_BASE_URL
            : undefined;
    const expoPublicModel =
        typeof process !== 'undefined'
            ? process.env.EXPO_PUBLIC_NANO_GPT_MODEL
            : undefined;
    const apiKey =
        extra.NANO_GPT_API_KEY ||
        extra.nanoGptApiKey ||
        expoPublicApiKey ||
        readProcessEnv('NANO_GPT_API_KEY');

    if (!apiKey) {
        throw new Error('Missing AI configuration: set NANO_GPT_API_KEY in your environment.');
    }

    const apiBaseUrl =
        extra.NANO_GPT_API_BASE_URL ||
        extra.nanoGptApiBaseUrl ||
        expoPublicApiBaseUrl ||
        readProcessEnv('NANO_GPT_API_BASE_URL') ||
        DEFAULT_API_BASE_URL;
    const model =
        extra.NANO_GPT_MODEL ||
        extra.nanoGptModel ||
        expoPublicModel ||
        readProcessEnv('NANO_GPT_MODEL') ||
        DEFAULT_MODEL;

    return { apiBaseUrl, apiKey, model };
}
