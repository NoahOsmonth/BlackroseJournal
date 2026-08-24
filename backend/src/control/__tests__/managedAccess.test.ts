import assert from 'node:assert/strict';
import http from 'node:http';
import { describe, it } from 'node:test';
import { createApp } from '../../app';
import { createReadinessController } from '../../readiness';
import { AccessTokenVerifier } from '../../auth/supabaseJwtVerifier';
import {
  AdminAuthorizer,
  createControlAdminAuthorizer,
} from '../../auth/adminAuthorization';

const readiness = createReadinessController({ probeAi: async () => true });

async function withApp(
  verifier: AccessTokenVerifier | undefined,
  allowedOrigins: string[] | null,
  run: (baseUrl: string) => Promise<void>,
  adminAuthorizer?: AdminAuthorizer,
): Promise<void> {
  const app = createApp({
    serverConfig: { port: 0, readiness, allowedOrigins },
    managedAccess: verifier ? { verifier, adminAuthorizer } : undefined,
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
      const response = await fetch(`${baseUrl}/v1/admin/providers`, {
        headers: {
          authorization: 'Bearer valid',
          origin: 'https://attacker.example',
        },
      });
      assert.equal(response.status, 403);
    });
  });

  it('returns 403 for normal users and forged user-metadata admin claims', async () => {
    const principals = [
      { userId: 'regular-id', role: 'authenticated' },
      {
        userId: 'regular-id',
        role: 'authenticated',
        user_metadata: { admin: true },
      },
    ];
    const adminAuthorizer = createControlAdminAuthorizer({
      findAdminByUserId: async () => null,
    });

    for (const principal of principals) {
      const verifier: AccessTokenVerifier = { verify: async () => principal };
      await withApp(verifier, ['https://admin.example'], async (baseUrl) => {
        const response = await fetch(`${baseUrl}/v1/admin/providers`, {
          headers: { authorization: 'Bearer valid' },
        });
        assert.equal(response.status, 403);
      }, adminAuthorizer);
    }
  });

  it('lets an explicitly persisted admin reach the configured-service boundary', async () => {
    const verifier: AccessTokenVerifier = {
      verify: async () => ({ userId: 'admin-id', role: 'authenticated' }),
    };
    const adminAuthorizer = createControlAdminAuthorizer({
      findAdminByUserId: async () => ({ userId: 'admin-id', role: 'owner' }),
    });

    await withApp(verifier, ['https://admin.example'], async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/admin/providers`, {
        headers: { authorization: 'Bearer valid' },
      });
      assert.equal(response.status, 503);
    }, adminAuthorizer);
  });
});
