import http from 'http';
import { AddressInfo } from 'net';
import { registerHealthRoutes } from '../../backend/src/routes/healthRoutes';
import type { ReadinessProvider } from '../../backend/src/readiness';

// Skipped unless RUN_INTEGRATION_TESTS=1: boots backend express health routes against a test server.
// Real reason: optional backend integration; root unit suite stays free of backend node_modules quirks.
// TODO(follow-up): none for on-device identity; re-enable when backend CI job is split.
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

function buildApp(readiness: ReadinessProvider): TestExpressApp {
    const app = express();
    // registerHealthRoutes expects an `Application` from express; at runtime
    // the structural TestExpressApp IS an Application. The `as never` cast
    // bridges the two tsconfig contexts (root has no @types/express).
    registerHealthRoutes(app as never, readiness);
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

describeMaybe('integration: /health and /ready', () => {
    it('GET /health is unconditional and exactly redacted', async () => {
        const app = buildApp({
            getSnapshot: () => ({
                ai: false,
                supabaseAuth: false,
                postgrestGateway: false,
                deploymentAuthority: false,
            }),
        });
        const { status, body } = await invoke(app, 'get', '/health');
        expect(status).toBe(200);
        expect(body).toEqual({ status: 'ok' });
    });

    it('GET /ready returns 200 only when every dependency is ready', async () => {
        const app = buildApp({
            getSnapshot: () => ({
                ai: true,
                supabaseAuth: true,
                postgrestGateway: true,
                deploymentAuthority: true,
            }),
        });
        const { status, body } = await invoke(app, 'get', '/ready');
        expect(status).toBe(200);
        expect(body).toEqual({
            status: 'ready',
            dependencies: {
                ai: true,
                supabaseAuth: true,
                postgrestGateway: true,
                deploymentAuthority: true,
            },
        });
    });

    it('GET /ready returns a stable 503 boolean snapshot', async () => {
        const app = buildApp({
            getSnapshot: () => ({
                ai: true,
                supabaseAuth: true,
                postgrestGateway: false,
                deploymentAuthority: false,
            }),
        });
        const { status, body } = await invoke(app, 'get', '/ready');
        expect(status).toBe(503);
        expect(body).toEqual({
            status: 'not_ready',
            dependencies: {
                ai: true,
                supabaseAuth: true,
                postgrestGateway: false,
                deploymentAuthority: false,
            },
        });
    });
});
