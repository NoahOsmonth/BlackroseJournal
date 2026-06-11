import fs from 'fs';
import path from 'path';

import { completeChat, Message, streamChat } from '../../services/ai';
import {
    fetchOpenAiCompatibleModels,
    getDefaultCustomAiProviderSettings,
    resetCustomModelStorageAdapter,
    saveCustomAiProviderSettings,
    setCustomModelStorageAdapter,
} from '../../services/ai/customModels';

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
    },
}));

const describeMaybe = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

interface NanoEnv {
    readonly apiKey: string;
    readonly apiBaseUrl: string;
    readonly model: string;
}

function readEnvFile(): Record<string, string> {
    const envPath = path.join(process.cwd(), '.env');
    const text = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
    return Object.fromEntries(text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => {
            const index = line.indexOf('=');
            return [line.slice(0, index), line.slice(index + 1)];
        }));
}

function getNanoEnv(): NanoEnv {
    const fileEnv = readEnvFile();
    const apiKey = process.env.EXPO_PUBLIC_NANO_GPT_API_KEY
        ?? fileEnv.EXPO_PUBLIC_NANO_GPT_API_KEY;
    if (!apiKey) throw new Error('Missing EXPO_PUBLIC_NANO_GPT_API_KEY for integration test.');

    return {
        apiKey,
        apiBaseUrl: (
            process.env.EXPO_PUBLIC_NANO_GPT_API_BASE_URL
            ?? fileEnv.EXPO_PUBLIC_NANO_GPT_API_BASE_URL
            ?? 'https://nano-gpt.com/api/v1'
        ).replace(/\/+$/, ''),
        model: process.env.EXPO_PUBLIC_NANO_GPT_MODEL
            ?? fileEnv.EXPO_PUBLIC_NANO_GPT_MODEL
            ?? 'nvidia/nemotron-3-ultra-550b-a55b',
    };
}

function applyNanoEnv(env: NanoEnv): void {
    process.env.EXPO_PUBLIC_NANO_GPT_API_KEY = env.apiKey;
    process.env.EXPO_PUBLIC_NANO_GPT_API_BASE_URL = env.apiBaseUrl;
    process.env.EXPO_PUBLIC_NANO_GPT_MODEL = env.model;
    process.env.EXPO_PUBLIC_NANO_GPT_FLASH_MODEL = env.model;
}

function createStorageAdapter() {
    const store = new Map<string, string>();
    return {
        getItem: (key: string) => Promise.resolve(store.get(key) ?? null),
        setItem: (key: string, value: string) => {
            store.set(key, value);
            return Promise.resolve();
        },
        removeItem: (key: string) => {
            store.delete(key);
            return Promise.resolve();
        },
    };
}

describeMaybe('integration: NanoGPT real key', () => {
    const originalEnv = { ...process.env };

    jest.setTimeout(45000);

    afterEach(() => {
        resetCustomModelStorageAdapter();
        process.env = { ...originalEnv };
    });

    it('fetches models and completes chat with the configured model', async () => {
        const env = getNanoEnv();
        applyNanoEnv(env);
        const models = await fetch(`${env.apiBaseUrl}/models`, {
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${env.apiKey}`,
            },
        });
        expect(models.status).toBe(200);
        const modelJson = await models.json() as { data?: unknown[] };
        expect(Array.isArray(modelJson.data)).toBe(true);

        const chat = await fetch(`${env.apiBaseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${env.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: env.model,
                messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
                stream: false,
                temperature: 0,
                max_tokens: 32768,
            }),
        });
        expect(chat.status).toBe(200);
        const chatJson = await chat.json() as {
            choices?: { message?: { content?: string } }[];
        };
        expect(chatJson.choices?.[0]?.message?.content?.trim()).toBeTruthy();
    });

    it('activates a fetched custom provider model for app chat', async () => {
        const env = getNanoEnv();
        applyNanoEnv(env);
        setCustomModelStorageAdapter(createStorageAdapter());

        const fetched = await fetchOpenAiCompatibleModels({
            baseUrl: env.apiBaseUrl,
            apiKey: env.apiKey,
            fallbackContextWindow: 32768,
        });
        const selected = fetched.models.find((model) => model.id === env.model)
            ?? fetched.models[0];
        expect(selected).toBeTruthy();

        await saveCustomAiProviderSettings({
            ...getDefaultCustomAiProviderSettings(),
            enabled: true,
            baseUrl: fetched.baseUrl,
            apiKey: env.apiKey,
            selectedModelId: selected.id,
            models: fetched.models,
        });

        const messages: Message[] = [{
            id: 'integration-user',
            role: 'user',
            content: 'Reply with exactly: ok',
            timestamp: Date.now(),
        }];
        const result = await completeChat(messages, 'You are concise.');

        expect(result.content.trim()).toBeTruthy();
    });

    it('streams app chat with the configured provider', async () => {
        applyNanoEnv(getNanoEnv());
        setCustomModelStorageAdapter(createStorageAdapter());
        const messages: Message[] = [{
            id: 'integration-stream-user',
            role: 'user',
            content: 'Reply with exactly: ok',
            timestamp: Date.now(),
        }];
        const onChunk = jest.fn();
        const onComplete = jest.fn();
        const onError = jest.fn();
        const originalXhr = global.XMLHttpRequest;
        delete (global as typeof globalThis & { XMLHttpRequest?: typeof XMLHttpRequest }).XMLHttpRequest;

        try {
            await streamChat(messages, onChunk, onComplete, onError, {
                systemPrompt: 'You are concise.',
                conversationId: 'integration-stream',
            });
        } finally {
            (global as typeof globalThis & { XMLHttpRequest?: typeof XMLHttpRequest }).XMLHttpRequest = originalXhr;
        }

        expect(onError).not.toHaveBeenCalled();
        expect(onChunk).toHaveBeenCalled();
        expect(onComplete).toHaveBeenCalled();
        const [content] = onComplete.mock.calls[0] as [string, string];
        expect(content.trim()).toBeTruthy();
    });
});
