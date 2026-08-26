import assert from 'node:assert/strict';
import http from 'node:http';
import { describe, it } from 'node:test';
import { createApp } from '../../app';
import type { AdminAuthorizer } from '../../auth/adminAuthorization';
import type { AccessTokenVerifier } from '../../auth/supabaseJwtVerifier';
import { createReadinessController } from '../../readiness';
import type { OmnirouteKeysService } from '../../control/omnirouteKeysService';
import { OmnirouteAdminValidationError } from '../../control/omnirouteAdminService';

const readiness = createReadinessController({ probeAi: async () => true });

function keysService(overrides: Partial<OmnirouteKeysService> = {}): OmnirouteKeysService {
  return {
    getUserKeyView: async (userId) => ({
      userId,
      omnirouteKeyId: 'key-1',
      maskedKey: 'sk-1••••7890',
      allowedModels: ['m:free'],
      revokedAt: null,
    }),
    setAllowedModels: async () => undefined,
    revokeUserKey: async () => undefined,
    listUsage: async () => [{ keyName: 'brj-user-1', requests: 5, totalTokens: 120 }],
    getEmbeddingsSettings: async () => ({ embeddingModel: 'embed:free' }),
    setEmbeddingsSettings: async (model) => ({ embeddingModel: model }),
    ...overrides,
  } as OmnirouteKeysService;
}

async function withApp(
  keys: OmnirouteKeysService | undefined,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const verifier: AccessTokenVerifier = {
    verify: async () => ({ userId: 'admin-id', role: 'authenticated' }),
  };
  const adminAuthorizer: AdminAuthorizer = {
    findAdmin: async (userId) => ({ userId, role: 'owner' as const }),
  };
  const app = createApp({
    serverConfig: { port: 0, readiness, allowedOrigins: ['https://admin.example'] },
    managedAccess: { verifier, adminAuthorizer },
    omnirouteKeys: keys,
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

const authHeaders = {
  authorization: 'Bearer valid',
  'content-type': 'application/json',
  origin: 'https://admin.example',
};

describe('omniroute keys proxy routes (Task 7)', () => {
  it('returns a masked key view; full secrets never cross the wire', async () => {
    await withApp(keysService(), async (baseUrl) => {
      const res = await fetch(`${baseUrl}/v1/admin/control/omniroute/keys/user-1`, { headers: authHeaders });
      assert.equal(res.status, 200);
      const body = await res.json() as { key: { maskedKey: string; userId: string } | null };
      assert.equal(body.key?.maskedKey, 'sk-1••••7890');
      assert.equal(body.key?.userId, 'user-1');
    });
  });

  it('returns key:null when the user has no active key', async () => {
    await withApp(keysService({ getUserKeyView: async () => null }), async (baseUrl) => {
      const res = await fetch(`${baseUrl}/v1/admin/control/omniroute/keys/nobody`, { headers: authHeaders });
      assert.deepEqual(await res.json(), { key: null });
    });
  });

  it('PATCHes allowed models and validates the body shape', async () => {
    let received: unknown = null;
    await withApp(keysService({
      setAllowedModels: async (_userId, models) => {
        received = models;
      },
    }), async (baseUrl) => {
      const ok = await fetch(`${baseUrl}/v1/admin/control/omniroute/keys/user-1/allowed-models`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ allowedModels: ['a:free'] }),
      });
      assert.equal(ok.status, 200);
      assert.deepEqual(received, ['a:free']);

      const bad = await fetch(`${baseUrl}/v1/admin/control/omniroute/keys/user-1/allowed-models`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ allowedModels: 'nope' }),
      });
      assert.equal(bad.status, 400);
    });
  });

  it('revokes via POST and maps validation errors to 400', async () => {
    let revokedFor = '';
    await withApp(keysService({
      revokeUserKey: async (userId) => {
        revokedFor = userId;
      },
    }), async (baseUrl) => {
      const res = await fetch(`${baseUrl}/v1/admin/control/omniroute/keys/user-1/revoke`, {
        method: 'POST',
        headers: authHeaders,
      });
      assert.equal(res.status, 200);
      assert.equal(revokedFor, 'user-1');
    });

    await withApp(keysService({
      revokeUserKey: async () => {
        throw new OmnirouteAdminValidationError('No active key.');
      },
    }), async (baseUrl) => {
      const res = await fetch(`${baseUrl}/v1/admin/control/omniroute/keys/user-1/revoke`, {
        method: 'POST',
        headers: authHeaders,
      });
      assert.equal(res.status, 400);
    });
  });

  it('lists brj-* usage rows only', async () => {
    await withApp(keysService(), async (baseUrl) => {
      const res = await fetch(`${baseUrl}/v1/admin/control/omniroute/usage`, { headers: authHeaders });
      const body = await res.json() as { usage: { keyName: string }[] };
      assert.deepEqual(body.usage.map((row) => row.keyName), ['brj-user-1']);
    });
  });

  it('gets and toggles embeddings settings (null disables)', async () => {
    await withApp(keysService(), async (baseUrl) => {
      const got = await fetch(`${baseUrl}/v1/admin/control/omniroute/embeddings`, { headers: authHeaders });
      assert.deepEqual(await got.json(), { embeddingModel: 'embed:free' });

      const off = await fetch(`${baseUrl}/v1/admin/control/omniroute/embeddings`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ embeddingModel: null }),
      });
      assert.deepEqual(await off.json(), { embeddingModel: null });
    });
  });

  it('503s when the keys service is not configured', async () => {
    await withApp(undefined, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/v1/admin/control/omniroute/usage`, { headers: authHeaders });
      assert.equal(res.status, 503);
    });
  });
});
