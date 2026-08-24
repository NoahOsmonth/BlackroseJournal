/* eslint-disable import/first */

jest.mock('../../../services/ai/customModels', () => ({
    loadCustomAiProviderSettings: jest.fn(async () => ({ enabled: false })),
}));

import { streamChatWithXhr } from '../../../services/ai/streamingTransports';
import { readStreamResponse } from '../../../services/ai/sseParser';
import {
    fetchManagedChatCompletion,
    resetManagedTransportSessionProvider,
    setManagedTransportSessionProvider,
} from '../../../services/ai/managedTransport';

const payload = {
    model: 'ignored', messages: [{ role: 'user' as const, content: 'hello' }],
    stream: true, temperature: 0.5, top_p: 0.9, max_tokens: 100,
};

const normalizedFailure = [
    'data: {"type":"text_delta","text":"partial"}',
    'data: {"type":"error","error":{"code":"upstream_error","message":"Provider failed.","retryable":false}}',
    'data: {"type":"completion","reason":"error"}',
    'data: [DONE]',
    '',
].join('\n\n');

describe('managed stream terminal errors', () => {
    const originalFetch = global.fetch;
    const originalXhr = globalThis.XMLHttpRequest;

    beforeEach(() => {
        process.env.EXPO_PUBLIC_AGENT_BASE_URL = 'https://gateway.example';
        setManagedTransportSessionProvider(async () => 'token');
    });

    afterEach(() => {
        global.fetch = originalFetch;
        globalThis.XMLHttpRequest = originalXhr;
        resetManagedTransportSessionProvider();
    });

    it('rejects a fetch stream that emits partial text before a normalized error', async () => {
        global.fetch = jest.fn(async () => new Response(normalizedFailure, {
            headers: { 'content-type': 'text/event-stream' },
        })) as unknown as typeof fetch;
        const response = await fetchManagedChatCompletion(payload);

        await expect(readStreamResponse(response.body!, jest.fn(), jest.fn()))
            .rejects.toThrow('Provider failed.');
    });

    it('rejects an XHR stream that emits partial text before a normalized error', async () => {
        class FailureXhr {
            responseText = '';
            readyState = 0;
            status = 200;
            onreadystatechange: (() => void) | null = null;
            onprogress: (() => void) | null = null;
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            open() {}
            setRequestHeader() {}
            send() {
                this.responseText = normalizedFailure;
                this.readyState = 4;
                this.onreadystatechange?.();
                this.onload?.();
            }
        }
        globalThis.XMLHttpRequest = FailureXhr as unknown as typeof XMLHttpRequest;

        await expect(streamChatWithXhr(payload, jest.fn(), jest.fn()))
            .rejects.toThrow('Provider failed.');
    });
});
