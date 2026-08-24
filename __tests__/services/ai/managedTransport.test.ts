import {
    fetchManagedChatCompletion,
    prepareManagedChatRequest,
    resetManagedTransportSessionProvider,
    setManagedTransportSessionProvider,
} from '../../../services/ai/managedTransport';
import { activateAccount, clearActiveAccount } from '../../../services/account/accountRuntime';

const payload = {
    model: 'must-not-cross-boundary',
    messages: [
        { role: 'system' as const, content: 'Be kind.' },
        { role: 'user' as const, content: 'Hello' },
    ],
    stream: false,
    temperature: 0.4,
    top_p: 0.8,
    max_tokens: 200,
};

describe('managedTransport', () => {
    const originalFetch = global.fetch;
    const originalBaseUrl = process.env.EXPO_PUBLIC_AGENT_BASE_URL;

    beforeEach(async () => {
        process.env.EXPO_PUBLIC_AGENT_BASE_URL = 'https://gateway.example';
        await activateAccount('account-a');
        setManagedTransportSessionProvider(async () => ({
            accessToken: 'verified-access-token', userId: 'account-a',
        }));
    });

    afterEach(async () => {
        global.fetch = originalFetch;
        process.env.EXPO_PUBLIC_AGENT_BASE_URL = originalBaseUrl;
        resetManagedTransportSessionProvider();
        await clearActiveAccount();
    });

    it('builds an authenticated normalized request without a client-selected provider model', async () => {
        const request = await prepareManagedChatRequest(payload, { modelPurpose: 'flash' });

        expect(request.url).toBe('https://gateway.example/v1/ai/chat/completions');
        expect(request.headers.Authorization).toBe('Bearer verified-access-token');
        expect(request.body).toMatchObject({
            purpose: 'flash',
            systemInstruction: 'Be kind.',
            messages: [{ role: 'user', content: 'Hello' }],
            maxOutputTokens: 200,
            stream: false,
        });
        expect(request.body).not.toHaveProperty('model');
    });

    it('rejects a valid Supabase session that belongs to a different local account', async () => {
        setManagedTransportSessionProvider(async () => ({
            accessToken: 'token-for-b', userId: 'account-b',
        }));

        await expect(prepareManagedChatRequest(payload)).rejects.toThrow(
            'Managed AI session does not match the active account.'
        );
    });

    it('holds account teardown until delayed managed session preparation settles', async () => {
        let resolveSession!: (session: { accessToken: string; userId: string }) => void;
        setManagedTransportSessionProvider(() => new Promise((resolve) => {
            resolveSession = resolve;
        }));
        const preparing = prepareManagedChatRequest(payload);
        const switching = activateAccount('account-b');
        await Promise.resolve();

        resolveSession({ accessToken: 'token-a', userId: 'account-a' });
        await expect(preparing).rejects.toThrow(
            'Managed AI request was cancelled by an account switch.'
        );
        await switching;
    });

    it('preserves assistant tool-call history for later managed agent rounds', async () => {
        const request = await prepareManagedChatRequest({
            ...payload,
            messages: [
                { role: 'assistant', content: null, tool_calls: [{
                    id: 'call-1', type: 'function',
                    function: { name: 'get_day', arguments: '{"day":"yesterday"}' },
                }] },
                { role: 'tool', content: 'A calm day.', tool_call_id: 'call-1', name: 'get_day' },
            ],
        });

        expect(request.body.messages).toEqual([
            {
                role: 'assistant', content: '',
                toolCalls: [{ id: 'call-1', name: 'get_day', arguments: '{"day":"yesterday"}' }],
            },
            { role: 'tool', content: 'A calm day.', toolCallId: 'call-1', name: 'get_day' },
        ]);
    });

    it('converts normalized non-stream events to the existing OpenAI-compatible consumer shape', async () => {
        global.fetch = jest.fn(async () => Response.json({ events: [
            { type: 'text_delta', text: 'Hello' },
            { type: 'tool_call_delta', index: 0, id: 'call-1', name: 'lookup', argumentsDelta: '{"day":"today"}' },
            { type: 'usage', inputTokens: 8, outputTokens: 3, totalTokens: 11 },
            { type: 'completion', reason: 'tool_calls' },
        ] })) as unknown as typeof fetch;

        const response = await fetchManagedChatCompletion(payload);
        const json = await response.json();

        expect(json).toEqual({
            choices: [{ message: {
                content: 'Hello',
                tool_calls: [{
                    id: 'call-1', type: 'function',
                    function: { name: 'lookup', arguments: '{"day":"today"}' },
                }],
            }, finish_reason: 'tool_calls' }],
            usage: { prompt_tokens: 8, completion_tokens: 3, total_tokens: 11 },
        });
    });

    it('converts normalized gateway SSE incrementally for existing stream parsers', async () => {
        const encoder = new TextEncoder();
        global.fetch = jest.fn(async () => new Response(new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(encoder.encode('data: {"type":"text_delta","text":"Hi"}\n\n'));
                controller.enqueue(encoder.encode('data: {"type":"completion","reason":"stop"}\n\n'));
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
            },
        }), { headers: { 'content-type': 'text/event-stream' } })) as unknown as typeof fetch;

        const response = await fetchManagedChatCompletion({ ...payload, stream: true });
        const text = await response.text();

        expect(text).toContain('"choices":[{"delta":{"content":"Hi"}}]');
        expect(text).toContain('"finish_reason":"stop"');
        expect(text).toContain('data: [DONE]');
    });

    it('converts a buffered SSE fallback when the runtime has no global Web Stream constructor', async () => {
        const upstream = new Response([
            'data: {"type":"text_delta","text":"Hi"}',
            'data: {"type":"completion","reason":"stop"}',
            'data: [DONE]',
            '',
        ].join('\n'), { headers: { 'content-type': 'text/event-stream' } });
        global.fetch = jest.fn(async () => upstream) as unknown as typeof fetch;
        const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'ReadableStream');
        Object.defineProperty(globalThis, 'ReadableStream', { configurable: true, value: undefined });
        try {
            const response = await fetchManagedChatCompletion({ ...payload, stream: true });
            await expect(response.text()).resolves.toContain('"content":"Hi"');
        } finally {
            if (descriptor) Object.defineProperty(globalThis, 'ReadableStream', descriptor);
        }
    });
});
