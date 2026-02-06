import Constants from 'expo-constants';

export interface AiConfig {
    apiBaseUrl: string;
    apiKey: string;
    model: string;
    flashModel: string;
}

type ExtraConfig = {
    NANO_GPT_API_KEY?: string;
    NANO_GPT_API_BASE_URL?: string;
    NANO_GPT_MODEL?: string;
    NANO_GPT_FLASH_MODEL?: string;
    nanoGptApiKey?: string;
    nanoGptApiBaseUrl?: string;
    nanoGptModel?: string;
    nanoGptFlashModel?: string;
};

const DEFAULT_API_BASE_URL = 'https://nano-gpt.com/api/v1';
const DEFAULT_MODEL = 'moonshotai/kimi-k2.5:thinking';
const DEFAULT_FLASH_MODEL = 'zai-org/glm-4.7-flash-original';

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
    const expoPublicFlashModel =
        typeof process !== 'undefined'
            ? process.env.EXPO_PUBLIC_NANO_GPT_FLASH_MODEL
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
    const flashModel =
        extra.NANO_GPT_FLASH_MODEL ||
        extra.nanoGptFlashModel ||
        expoPublicFlashModel ||
        readProcessEnv('NANO_GPT_FLASH_MODEL') ||
        DEFAULT_FLASH_MODEL;

    return { apiBaseUrl, apiKey, model, flashModel };
}
