import assert from 'node:assert/strict';
import http from 'node:http';
import { describe, it } from 'node:test';
import { createApp } from '../../app';
import type { AdminAuthorizer } from '../../auth/adminAuthorization';
import type { AccessTokenVerifier } from '../../auth/supabaseJwtVerifier';
import { createReadinessController } from '../../readiness';
import { ControlPlaneConflictError, ControlPlaneValidationError } from '../controlPlaneService';
import type { ControlPlaneRouteService } from '../../routes/controlPlaneRoutes';

const readiness = createReadinessController({ probeAi: async () => true });

function routeService(
  overrides: Partial<ControlPlaneRouteService> = {},
): ControlPlaneRouteService {
  return {
    getCatalog: async () => ({ revision: 3, models: [] }),
    getPreference: async () => null,
    updatePreference: async (_userId, input) => ({
      selectedModelId: input.modelId,
      revision: 1,
      updatedAt: '2026-08-24T00:00:00.000Z',
    }),
    listProviders: async () => [],
    getProvider: async () => null,
    getProviderHealth: async (id) => ({
      providerId: id,
      status: 'unavailable',
      checkedAt: '2026-08-24T00:00:00.000Z',
    }),
    createProvider: async () => { throw new Error('unused'); },
    updateProvider: async () => { throw new Error('unused'); },
    archiveProvider: async () => { throw new Error('unused'); },
    rotateCredential: async () => { throw new Error('unused'); },
    rekeyProviderCredential: async () => { throw new Error('unused'); },
    discoverProvider: async () => { throw new Error('unused'); },
    listProviderModels: async () => [],
    archiveProviderModel: async () => { throw new Error('unused'); },
    publishCatalogModel: async () => { throw new Error('unused'); },
    archiveCatalogModel: async () => { throw new Error('unused'); },
    createFlashRoute: async () => { throw new Error('unused'); },
    getRuntimeSettings: async () => ({
      activeFlashRouteId: null,
      maxInputBytes: 1_048_576,
      maxOutputTokens: 8_192,
      requestTimeoutMs: 120_000,
      revision: 1,
      updatedAt: '2026-08-24T00:00:00.000Z',
    }),
    updateRuntimeSettings: async () => { throw new Error('unused'); },
    listAuditEvents: async () => [],
    ...overrides,
  };
}

async function withApp(
  service: ControlPlaneRouteService,
  run: (baseUrl: string) => Promise<void>,
  adminRole: 'owner' | 'admin' | 'auditor' = 'owner',
): Promise<void> {
  const verifier: AccessTokenVerifier = {
    verify: async () => ({ userId: 'admin-id', role: 'authenticated' }),
  };
  const adminAuthorizer: AdminAuthorizer = {
    findAdmin: async (userId) => ({ userId, role: adminRole }),
  };
  const app = createApp({
    serverConfig: { port: 0, readiness, allowedOrigins: ['https://admin.example'] },
    managedAccess: { verifier, adminAuthorizer },
    controlPlaneService: service,
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
};

describe('control plane routes', () => {
  it('returns the authenticated-safe catalog to signed-in clients', async () => {
    await withApp(routeService(), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/ai/catalog`, { headers: authHeaders });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { revision: 3, models: [] });
    });
  });

  it('returns one admin-safe provider without credential material', async () => {
    await withApp(routeService({
      getProvider: async () => ({
        id: 'provider-1',
        name: 'Example',
        protocol: 'openai-chat-completions',
        baseUrl: 'https://models.example/v1',
        state: 'active',
        revision: 1,
        createdAt: '2026-08-24T00:00:00.000Z',
        updatedAt: '2026-08-24T00:00:00.000Z',
      }),
    }), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/admin/providers/provider-1`, {
        headers: { ...authHeaders, origin: 'https://admin.example' },
      });
      assert.equal(response.status, 200);
      assert.doesNotMatch(await response.text(), /credential|ciphertext|secret/i);
    });
  });

  it('binds preference updates to the authenticated user rather than request data', async () => {
    let selectedUser = '';
    await withApp(routeService({
      updatePreference: async (userId, input) => {
        selectedUser = userId;
        return {
          selectedModelId: input.modelId,
          revision: 1,
          updatedAt: '2026-08-24T00:00:00.000Z',
        };
      },
    }), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/ai/preferences/model`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ modelId: 'catalog-1' }),
      });
      assert.equal(response.status, 200);
      assert.equal(selectedUser, 'admin-id');
    });
  });

  it('strictly rejects secret-bearing provider fields outside the credential DTO', async () => {
    let called = false;
    await withApp(routeService({
      createProvider: async () => {
        called = true;
        throw new Error('must not run');
      },
    }), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/admin/providers`, {
        method: 'POST',
        headers: { ...authHeaders, origin: 'https://admin.example' },
        body: JSON.stringify({
          name: 'Example',
          protocol: 'openai-chat-completions',
          baseUrl: 'https://models.example/v1',
          apiKey: 'top-level-secret',
          credential: { secret: 'nested-secret' },
        }),
      });
      assert.equal(response.status, 400);
      assert.equal(called, false);
      assert.doesNotMatch(await response.text(), /top-level-secret|nested-secret/);
    });
  });

  it('maps unsafe provider endpoint validation to a secret-free client error', async () => {
    await withApp(routeService({
      createProvider: async () => { throw new ControlPlaneValidationError(); },
    }), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/admin/providers`, {
        method: 'POST',
        headers: { ...authHeaders, origin: 'https://admin.example' },
        body: JSON.stringify({
          name: 'Unsafe',
          protocol: 'openai-chat-completions',
          baseUrl: 'https://127.0.0.1/v1',
          credential: { secret: 'must-not-leak' },
        }),
      });
      assert.equal(response.status, 400);
      assert.doesNotMatch(await response.text(), /127\.0\.0\.1|must-not-leak/);
    });
  });

  it('returns a safe current state on optimistic revision conflicts', async () => {
    await withApp(routeService({
      updateProvider: async () => {
        throw new ControlPlaneConflictError({
          id: 'provider-1',
          name: 'Current',
          protocol: 'openai-chat-completions',
          baseUrl: 'https://models.example/v1',
          state: 'active',
          revision: 7,
          createdAt: '2026-08-24T00:00:00.000Z',
          updatedAt: '2026-08-24T00:00:00.000Z',
        });
      },
    }), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/admin/providers/provider-1`, {
        method: 'PATCH',
        headers: { ...authHeaders, origin: 'https://admin.example' },
        body: JSON.stringify({ expectedRevision: 1, name: 'Stale update' }),
      });
      assert.equal(response.status, 409);
      assert.deepEqual(await response.json(), {
        code: 'revision_conflict',
        message: 'The resource changed before this mutation was applied.',
        currentRevision: 7,
        currentState: {
          id: 'provider-1',
          name: 'Current',
          protocol: 'openai-chat-completions',
          baseUrl: 'https://models.example/v1',
          state: 'active',
          revision: 7,
          createdAt: '2026-08-24T00:00:00.000Z',
          updatedAt: '2026-08-24T00:00:00.000Z',
        },
      });
    });
  });

  it('allows auditors to read but forbids provider mutations', async () => {
    let called = false;
    await withApp(routeService({
      createProvider: async () => {
        called = true;
        throw new Error('must not run');
      },
    }), async (baseUrl) => {
      const list = await fetch(`${baseUrl}/v1/admin/providers`, {
        headers: { ...authHeaders, origin: 'https://admin.example' },
      });
      assert.equal(list.status, 200);

      const create = await fetch(`${baseUrl}/v1/admin/providers`, {
        method: 'POST',
        headers: { ...authHeaders, origin: 'https://admin.example' },
        body: JSON.stringify({
          name: 'Example',
          protocol: 'openai-chat-completions',
          baseUrl: 'https://models.example/v1',
          credential: { secret: 'nested-secret' },
        }),
      });
      assert.equal(create.status, 403);
      assert.equal(called, false);
    }, 'auditor');
  });

  it('rekeys a credential using only the provider revision from the request', async () => {
    let received: readonly [string, string, number] | undefined;
    await withApp(routeService({
      rekeyProviderCredential: async (actor, id, expectedRevision) => {
        received = [actor, id, expectedRevision];
        return {
          id,
          name: 'Example',
          protocol: 'openai-chat-completions',
          baseUrl: 'https://models.example/v1',
          state: 'active',
          revision: 2,
          credential: { keyVersion: 3, lastFour: '1234' },
          createdAt: '2026-08-24T00:00:00.000Z',
          updatedAt: '2026-08-24T00:00:00.000Z',
        };
      },
    }), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/admin/providers/provider-1/credential/rekey`, {
        method: 'POST',
        headers: { ...authHeaders, origin: 'https://admin.example' },
        body: JSON.stringify({ expectedRevision: 1 }),
      });
      assert.equal(response.status, 200);
      assert.deepEqual(received, ['admin-id', 'provider-1', 1]);
      assert.doesNotMatch(await response.text(), /ciphertext|plaintext|secret/i);
    });
  });
});
