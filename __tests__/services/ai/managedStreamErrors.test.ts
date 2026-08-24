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
import { activateAccount, clearActiveAccount } from '../../../services/account/accountRuntime';

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

    beforeEach(async () => {
        process.env.EXPO_PUBLIC_AGENT_BASE_URL = 'https://gateway.example';
        await activateAccount('account-a');
        setManagedTransportSessionProvider(async () => ({
            accessToken: 'token', userId: 'account-a',
        }));
    });

    afterEach(async () => {
        global.fetch = originalFetch;
        globalThis.XMLHttpRequest = originalXhr;
        resetManagedTransportSessionProvider();
        await clearActiveAccount();
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

    it('aborts partial managed XHR and suppresses stale progress after an account switch', async () => {
        let resolveSent!: () => void;
        const sent = new Promise<void>((resolve) => { resolveSent = resolve; });
        let instance!: {
            responseText: string;
            onprogress: (() => void) | null;
            onabort: (() => void) | null;
            abort: jest.Mock;
        };
        class PartialXhr {
            responseText = '';
            readyState = 3;
            status = 200;
            onreadystatechange: (() => void) | null = null;
            onprogress: (() => void) | null = null;
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            onabort: (() => void) | null = null;
            abort = jest.fn(() => this.onabort?.());
            open() { /* no-op */ }
            setRequestHeader() { /* no-op */ }
            send() {
                instance = this;
                this.responseText = 'data: {"type":"text_delta","text":"from-a"}\n\n';
                this.onprogress?.();
                resolveSent();
            }
        }
        globalThis.XMLHttpRequest = PartialXhr as unknown as typeof XMLHttpRequest;
        const onChunk = jest.fn();
        const streaming = streamChatWithXhr(payload, onChunk, jest.fn());
        await sent;
        expect(onChunk).toHaveBeenCalledWith('from-a', undefined);

        await activateAccount('account-b');
        instance.responseText += [
            'data: {"type":"text_delta","text":"stale-a"}',
            'data: {"type":"completion","reason":"stop"}',
            'data: [DONE]',
            '',
        ].join('\n\n');
        instance.onprogress?.();

        await expect(streaming).rejects.toThrow(
            'Managed AI request was cancelled by an account switch.'
        );
        expect(instance.abort).toHaveBeenCalledTimes(1);
        expect(onChunk).toHaveBeenCalledTimes(1);
    });
});
