import assert from 'node:assert/strict';
import http from 'node:http';
import { describe, it } from 'node:test';
import { createApp } from '../../app';
import { createReadinessController } from '../../readiness';
import { AccessTokenVerifier } from '../../auth/supabaseJwtVerifier';

const readiness = createReadinessController({ probeAi: async () => true });

async function withApp(
  verifier: AccessTokenVerifier | undefined,
  allowedOrigins: string[] | null,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const app = createApp({
    serverConfig: { port: 0, readiness, allowedOrigins },
    managedAccess: verifier ? { verifier } : undefined,
  });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => {
      if (error) reject(error); else resolve();
    }));
  }
}

describe('managed route access', () => {
  it('fails closed when managed JWT verification is not configured', async () => {
    await withApp(undefined, ['https://admin.example'], async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/ai/catalog`, {
        headers: { authorization: 'Bearer ignored' },
      });
      assert.equal(response.status, 503);
    });
  });

  it('rejects missing bearer tokens before a managed route can run', async () => {
    const verifier: AccessTokenVerifier = {
      verify: async () => ({ userId: 'user-1', role: 'authenticated' }),
    };
    await withApp(verifier, ['https://admin.example'], async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/memory/recall`);
      assert.equal(response.status, 401);
    });
  });

  it('authenticates before parsing a managed request body', async () => {
    const verifier: AccessTokenVerifier = {
      verify: async () => ({ userId: 'user-1', role: 'authenticated' }),
    };
    await withApp(verifier, ['https://admin.example'], async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/ai/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{invalid-json',
      });
      assert.equal(response.status, 401);
    });
  });

  it('rejects browser origins unless an explicit managed allowlist contains them', async () => {
    const verifier: AccessTokenVerifier = {
      verify: async () => ({ userId: 'user-1', role: 'authenticated' }),
    };
    await withApp(verifier, null, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/ai/catalog`, {
        headers: {
          authorization: 'Bearer valid',
          origin: 'https://attacker.example',
        },
      });
      assert.equal(response.status, 403);
    });
  });

  it('answers CORS preflight on managed routes without requiring credentials', async () => {
    const verifier: AccessTokenVerifier = {
      verify: async () => ({ userId: 'user-1', role: 'authenticated' }),
    };
    await withApp(verifier, ['http://localhost:8081'], async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/ai/catalog`, {
        method: 'OPTIONS',
        headers: {
          origin: 'http://localhost:8081',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'authorization,content-type',
        },
      });
      assert.equal(response.status, 204);
      assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:8081');
    });
  });
});
