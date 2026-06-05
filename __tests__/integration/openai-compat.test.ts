import http from 'http';
import { AddressInfo } from 'net';

const describeMaybe = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

interface CapturedRequest {
    method?: string;
    url?: string;
    headers: http.IncomingHttpHeaders;
    body: string;
}

function startFakeUpstream(): Promise<{ url: string; captured: CapturedRequest[]; close: () => Promise<void> }> {
    return new Promise((resolve) => {
        const captured: CapturedRequest[] = [];
        const server = http.createServer((req, res) => {
            const chunks: Buffer[] = [];
            req.on('data', (chunk) => chunks.push(chunk as Buffer));
            req.on('end', () => {
                captured.push({
                    method: req.method,
                    url: req.url,
                    headers: req.headers,
                    body: Buffer.concat(chunks).toString('utf-8'),
                });
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                    id: 'chatcmpl-test',
                    object: 'chat.completion',
                    created: Math.floor(Date.now() / 1000),
                    model: 'test-model',
                    choices: [
                        {
                            index: 0,
                            message: {
                                role: 'assistant',
                                content: 'Hello from the fake upstream.',
                                reasoning: 'a brief thought',
                                reasoning_content: 'a brief thought',
                            },
                            finish_reason: 'stop',
                        },
                    ],
                }));
            });
        });
        server.listen(0, '127.0.0.1', () => {
            const port = (server.address() as AddressInfo).port;
            resolve({
                url: `http://127.0.0.1:${port}`,
                captured,
                close: () =>
                    new Promise<void>((closeResolve) => {
                        server.close(() => closeResolve());
                    }),
            });
        });
    });
}

describeMaybe('integration: openai-compat adapter request/response contract', () => {
    const originalKey = process.env.NANO_GPT_API_KEY;
    const originalBase = process.env.NANO_GPT_API_BASE_URL;
    const originalModel = process.env.NANO_GPT_MODEL;
    const originalFlash = process.env.NANO_GPT_FLASH_MODEL;

    beforeAll(() => {
        jest.resetModules();
    });

    afterAll(() => {
        if (originalKey === undefined) delete process.env.NANO_GPT_API_KEY;
        else process.env.NANO_GPT_API_KEY = originalKey;
        if (originalBase === undefined) delete process.env.NANO_GPT_API_BASE_URL;
        else process.env.NANO_GPT_API_BASE_URL = originalBase;
        if (originalModel === undefined) delete process.env.NANO_GPT_MODEL;
        else process.env.NANO_GPT_MODEL = originalModel;
        if (originalFlash === undefined) delete process.env.NANO_GPT_FLASH_MODEL;
        else process.env.NANO_GPT_FLASH_MODEL = originalFlash;
    });

    it('sends a parseable body and parses the OpenAI-shape response', async () => {
        const server = await startFakeUpstream();
        try {
            process.env.NANO_GPT_API_KEY = 'sk-test-key';
            process.env.NANO_GPT_API_BASE_URL = server.url;
            process.env.NANO_GPT_MODEL = 'integration-test-model';
            process.env.NANO_GPT_FLASH_MODEL = 'integration-test-flash';

            const { createChatCompletion } = await import('../../backend/src/agent/modelClient');

            const result = await createChatCompletion(
                [
                    { role: 'system', content: 'You are concise.' },
                    { role: 'user', content: 'Say hello.' },
                ],
                { temperature: 0.5, maxTokens: 64 }
            );

            expect(result.content).toBe('Hello from the fake upstream.');
            expect(result.reasoning).toBe('a brief thought');

            expect(server.captured).toHaveLength(1);
            const sent = server.captured[0];
            expect(sent.method).toBe('POST');
            expect(sent.url).toBe('/chat/completions');
            expect(sent.headers.authorization).toBe('Bearer sk-test-key');
            expect(sent.headers['content-type']).toBe('application/json');

            const body = JSON.parse(sent.body) as Record<string, unknown>;
            expect(body).toEqual(
                expect.objectContaining({
                    model: 'integration-test-model',
                    stream: false,
                    temperature: 0.5,
                    messages: expect.arrayContaining([
                        expect.objectContaining({ role: 'system', content: 'You are concise.' }),
                        expect.objectContaining({ role: 'user', content: 'Say hello.' }),
                    ]),
                })
            );
            expect(typeof body.max_tokens).toBe('number');
        } finally {
            await server.close();
        }
    });

    it('uses the explicit model override when provided in the options', async () => {
        const server = await startFakeUpstream();
        try {
            process.env.NANO_GPT_API_KEY = 'sk-test-key';
            process.env.NANO_GPT_API_BASE_URL = server.url;
            process.env.NANO_GPT_MODEL = 'default-model';
            process.env.NANO_GPT_FLASH_MODEL = 'default-flash';

            const { createChatCompletion } = await import('../../backend/src/agent/modelClient');

            await createChatCompletion(
                [{ role: 'user', content: 'hi' }],
                { model: 'override-model', temperature: 0.3, maxTokens: 32 }
            );

            const sent = server.captured[0];
            const body = JSON.parse(sent.body) as { model: string };
            expect(body.model).toBe('override-model');
        } finally {
            await server.close();
        }
    });
});
