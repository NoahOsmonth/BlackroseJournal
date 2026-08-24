import {
    fetchManagedChatCompletion,
    prepareManagedChatRequest,
    resetManagedTransportSessionProvider,
    setManagedTransportSessionProvider,
} from '../../../services/ai/managedTransport';

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

    beforeEach(() => {
        process.env.EXPO_PUBLIC_AGENT_BASE_URL = 'https://gateway.example';
        setManagedTransportSessionProvider(async () => 'verified-access-token');
    });

    afterEach(() => {
        global.fetch = originalFetch;
        process.env.EXPO_PUBLIC_AGENT_BASE_URL = originalBaseUrl;
        resetManagedTransportSessionProvider();
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
});
