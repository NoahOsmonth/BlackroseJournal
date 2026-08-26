import assert from 'node:assert/strict';
import http from 'node:http';
import { describe, it } from 'node:test';
import { createApp } from '../../app';
import type { AdminAuthorizer } from '../../auth/adminAuthorization';
import type { AccessTokenVerifier } from '../../auth/supabaseJwtVerifier';
import { createReadinessController } from '../../readiness';
import {
  OmnirouteAdminValidationError,
  createOmnirouteAdminService,
} from '../omnirouteAdminService';

const readiness = createReadinessController({ probeAi: async () => true });

function omnirouteService() {
  return createOmnirouteAdminService({
    adapter: {
      listProviders: async () => [{ id: 'p1', name: 'openrouter', status: 'connected' }],
      createProvider: async () => ({}),
      testProvider: async (id) => ({ valid: id === 'p1', latencyMs: 12 }),
      listCombos: async () => [{ id: 'free/a:free' }, { id: 'paid/pro' }],
      upsertCombo: async () => ({}),
      listKeys: async () => [],
      createKey: async () => ({ id: 'k', key: 'sk' }),
      updateKey: async () => ({}),
      revokeKey: async () => ({}),
    },
    store: {
      list: async () => [{ modelId: 'free/a:free', label: 'Free A' }],
      upsert: async () => undefined,
      remove: async () => undefined,
    },
  });
}

async function withApp(
  service: ReturnType<typeof omnirouteService> | undefined,
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
    omnirouteControl: service,
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

describe('omniroute control proxy routes', () => {
  it('reports the flag status for the admin app', async () => {
    await withApp(omnirouteService(), async (baseUrl) => {
      const on = await fetch(`${baseUrl}/v1/admin/control/omniroute/status`, { headers: authHeaders });
      assert.deepEqual(await on.json(), { enabled: true, flag: 'on' });
    });
    await withApp(undefined, async (baseUrl) => {
      const off = await fetch(`${baseUrl}/v1/admin/control/omniroute/status`, { headers: authHeaders });
      assert.deepEqual(await off.json(), { enabled: false, flag: 'off' });
    });
  });

  it('proxies provider listing and testing without exposing OmniRoute to the client', async () => {
    await withApp(omnirouteService(), async (baseUrl) => {
      const providers = await fetch(`${baseUrl}/v1/admin/control/omniroute/providers`, {
        headers: authHeaders,
      });
      assert.equal(providers.status, 200);
      assert.match(await providers.text(), /openrouter/);

      const test = await fetch(`${baseUrl}/v1/admin/control/omniroute/providers/test/p1`, {
        method: 'POST',
        headers: authHeaders,
      });
      assert.deepEqual(await test.json(), { valid: true, latencyMs: 12 });
    });
  });

  it('lists free-only models with the published allowlist', async () => {
    await withApp(omnirouteService(), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/admin/control/omniroute/models`, {
        headers: authHeaders,
      });
      const body = await response.json() as { models: { id: string }[]; published: unknown[] };
      assert.deepEqual(body.models.map((model) => model.id), ['free/a:free']);
      assert.equal(body.published.length, 1);
    });
  });

  it('rejects disconnect without the typed confirmation and never exposes DELETE', async () => {
    await withApp(omnirouteService(), async (baseUrl) => {
      const missing = await fetch(`${baseUrl}/v1/admin/control/omniroute/providers/disconnect`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ providerName: 'openrouter', confirmation: 'openrouter' }),
      });
      assert.equal(missing.status, 400);
      const body = await missing.json() as { error?: { code?: string } };
      assert.equal(body.error?.code, 'CONFIRMATION_REQUIRED');
    });
  });

  it('maps validation errors to 400', async () => {
    const failing = createOmnirouteAdminService({
      adapter: {
        listProviders: async () => [],
        createProvider: async () => ({}),
        testProvider: async () => ({ valid: true }),
        listCombos: async () => [],
        upsertCombo: async () => ({}),
        listKeys: async () => [],
        createKey: async () => ({ id: 'k', key: 'sk' }),
        updateKey: async () => ({}),
        revokeKey: async () => ({}),
      },
      store: {
        list: async () => [],
        upsert: async () => {
          throw new OmnirouteAdminValidationError('nope');
        },
        remove: async () => undefined,
      },
    });
    await withApp(failing, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/admin/control/omniroute/published-models`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ upserts: [{ modelId: 'paid/x', label: 'X' }], removes: [] }),
      });
      assert.equal(response.status, 400);
    });
  });

  it('updates the published allowlist via PUT', async () => {
    let removed: string[] = [];
    const svc = createOmnirouteAdminService({
      adapter: {
        listProviders: async () => [],
        createProvider: async () => ({}),
        testProvider: async () => ({ valid: true }),
        listCombos: async () => [],
        upsertCombo: async () => ({}),
        listKeys: async () => [],
        createKey: async () => ({ id: 'k', key: 'sk' }),
        updateKey: async () => ({}),
        revokeKey: async () => ({}),
      },
      store: {
        list: async () => [{ modelId: 'free/b:free', label: 'B' }],
        upsert: async () => undefined,
        remove: async (ids) => {
          removed = ids;
        },
      },
    });
    await withApp(svc, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/admin/control/omniroute/published-models`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ upserts: [], removes: ['free/a:free'] }),
      });
      assert.equal(response.status, 200);
      assert.deepEqual(removed, ['free/a:free']);
    });
  });

  it('disconnect succeeds with the exact phrase and audits allowlist removal only', async () => {
    const auditEvents: unknown[] = [];
    const svc = createOmnirouteAdminService({
      adapter: {
        listProviders: async () => [],
        createProvider: async () => ({}),
        testProvider: async () => ({ valid: true }),
        listCombos: async () => [],
        upsertCombo: async () => ({}),
        listKeys: async () => [],
        createKey: async () => ({ id: 'k', key: 'sk' }),
        updateKey: async () => ({}),
        revokeKey: async () => ({}),
      },
      store: (() => {
        const rows = [{ modelId: 'openrouter/a:free', label: 'A' }];
        return {
          list: async () => rows.map((row) => ({ ...row })),
          upsert: async () => undefined,
          remove: async (ids: string[]) => {
            const drop = new Set(ids);
            for (let index = rows.length - 1; index >= 0; index -= 1) {
              if (drop.has(rows[index].modelId)) rows.splice(index, 1);
            }
          },
        };
      })(),
      audit: async (event) => {
        auditEvents.push(event);
      },
    });
    await withApp(svc, async (baseUrl) => {
      const ok = await fetch(`${baseUrl}/v1/admin/control/omniroute/providers/disconnect`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ providerName: 'openrouter', confirmation: 'DELETE PROVIDER openrouter' }),
      });
      assert.equal(ok.status, 200);
      const body = await ok.json() as { published: unknown[] };
      assert.equal(body.published.length, 0);
      assert.equal(auditEvents.length, 1);
    });
  });
});
