import http from 'http';
import { AddressInfo } from 'net';
import { registerHealthRoutes } from '../../backend/src/routes/healthRoutes';
import { getAiConfig, loadConfig } from '../../backend/src/config/ai';

const describeMaybe = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

interface TestResponse {
    status(code: number): TestResponse;
    json(body: unknown): void;
}

interface TestExpressApp {
    get(path: string, handler: (req: unknown, res: TestResponse) => void): void;
    listen(
        port: number,
        host: string,
        cb: () => void
    ): { address: () => { port: number } | null; close: (cb?: () => void) => void };
}

// Root jest-expo has no express dependency; backend does. We pull the runtime
// module from the backend's node_modules and use it through a structural type
// so we don't depend on express types at the root.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const express = require('../../backend/node_modules/express') as () => TestExpressApp;

const VALID_ENV = {
    AI_DEFAULT_API_KEY: 'sk-test-key-1234',
    AI_DEFAULT_API_BASE_URL: 'https://nano-gpt.com/api/v1',
    AI_DEFAULT_MODEL: 'nvidia/nemotron-3-ultra-550b-a55b',
    AI_DEFAULT_FLASH_MODEL: 'nvidia/nemotron-3-ultra-550b-a55b',
};

function buildApp(): TestExpressApp {
    const app = express();
    // registerHealthRoutes expects an `Application` from express; at runtime
    // the structural TestExpressApp IS an Application. The `as never` cast
    // bridges the two tsconfig contexts (root has no @types/express).
    registerHealthRoutes(app as never);
    return app;
}

interface InvokeResult {
    status: number;
    body: unknown;
}

function invoke(
    app: TestExpressApp,
    method: 'get' | 'post',
    path: string
): Promise<InvokeResult> {
    return new Promise((resolve, reject) => {
        const server = app.listen(0, '127.0.0.1', () => {
            const address = server.address();
            if (!address || typeof address === 'string') {
                server.close();
                reject(new Error('Failed to bind test server.'));
                return;
            }
            const { port } = address as AddressInfo;
            const url = `http://127.0.0.1:${port}${path}`;
            const req = http.request(
                url,
                { method: method.toUpperCase() },
                (res) => {
                    const chunks: Buffer[] = [];
                    res.on('data', (chunk) => chunks.push(chunk));
                    res.on('end', () => {
                        const text = Buffer.concat(chunks).toString('utf-8');
                        let body: unknown = text;
                        try {
                            body = JSON.parse(text);
                        } catch {
                            // keep as text
                        }
                        server.close();
                        resolve({ status: res.statusCode ?? 0, body });
                    });
                }
            );
            req.on('error', (err) => {
                server.close();
                reject(err);
            });
            req.end();
        });
    });
}

describeMaybe('integration: /health and /ready (PR4)', () => {
    const originalEnv = process.env;

    afterAll(() => {
        process.env = originalEnv;
    });

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv, ...VALID_ENV };
    });

    it('GET /health returns 200 with config.valid === true', async () => {
        loadConfig();
        getAiConfig();
        const app = buildApp();
        const { status, body } = await invoke(app, 'get', '/health');
        expect(status).toBe(200);
        const payload = body as {
            status: string;
            config: { valid: boolean; profiles: string[]; defaultProfile: string };
        };
        expect(payload.status).toBe('ok');
        expect(payload.config.valid).toBe(true);
        expect(payload.config.profiles).toEqual(expect.arrayContaining(['default', 'fast']));
        expect(payload.config.defaultProfile).toBe('default');
    });

    it('GET /ready returns 200 when at least one profile is valid', async () => {
        loadConfig();
        getAiConfig();
        const app = buildApp();
        const { status, body } = await invoke(app, 'get', '/ready');
        expect(status).toBe(200);
        const payload = body as { status: string; profiles: string[] };
        expect(payload.status).toBe('ready');
        expect(payload.profiles).toEqual(expect.arrayContaining(['default', 'fast']));
    });

    it('GET /health surfaces 503 when AI_DEFAULT_API_KEY is missing', async () => {
        const envWithoutKey = { ...originalEnv };
        delete (envWithoutKey as Record<string, unknown>).AI_DEFAULT_API_KEY;
        process.env = envWithoutKey;
        jest.resetModules();
        // Re-require the routes module so it picks up the missing config.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { registerHealthRoutes: registerFresh } = require('../../backend/src/routes/healthRoutes') as typeof import('../../backend/src/routes/healthRoutes');
        const app = express() as TestExpressApp;
        registerFresh(app as never);
        const { status, body } = await invoke(app, 'get', '/health');
        expect(status).toBe(503);
        const payload = body as { status: string; error?: string };
        expect(payload.status).toBe('unavailable');
        expect(payload.error).toMatch(/API_KEY|apiKey/);
    });
});
