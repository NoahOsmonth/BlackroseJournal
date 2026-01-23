import Constants from 'expo-constants';

export interface AgentConfig {
    apiBaseUrl: string;
    apiKey?: string;
}

type ExtraConfig = {
    AGENT_BASE_URL?: string;
    AGENT_API_KEY?: string;
    agentBaseUrl?: string;
    agentApiKey?: string;
};

const DEFAULT_API_BASE_URL = 'http://localhost:8787';

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

export function getAgentConfig(): AgentConfig {
    const extra = getExtraConfig();
    const expoPublicBaseUrl = typeof process !== 'undefined'
        ? process.env.EXPO_PUBLIC_AGENT_BASE_URL
        : undefined;
    const expoPublicApiKey = typeof process !== 'undefined'
        ? process.env.EXPO_PUBLIC_AGENT_API_KEY
        : undefined;

    const apiBaseUrl =
        extra.AGENT_BASE_URL ||
        extra.agentBaseUrl ||
        expoPublicBaseUrl ||
        readProcessEnv('AGENT_BASE_URL') ||
        DEFAULT_API_BASE_URL;

    const apiKey =
        extra.AGENT_API_KEY ||
        extra.agentApiKey ||
        expoPublicApiKey ||
        readProcessEnv('AGENT_API_KEY');

    return { apiBaseUrl, apiKey };
}
