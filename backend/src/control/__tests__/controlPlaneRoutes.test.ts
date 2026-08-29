import assert from 'node:assert/strict';
import http from 'node:http';
import { describe, it } from 'node:test';
import { createApp } from '../../app';
import type { AdminAuthorizer } from '../../auth/adminAuthorization';
import type { AccessTokenVerifier } from '../../auth/supabaseJwtVerifier';
import { createReadinessController } from '../../readiness';
import { ControlPlaneConflictError } from '../controlPlaneService';
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
    ...overrides,
  };
}

async function withApp(
  service: ControlPlaneRouteService,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const verifier: AccessTokenVerifier = {
    verify: async () => ({ userId: 'admin-id', role: 'authenticated' }),
  };
  const adminAuthorizer: AdminAuthorizer = {
    findAdmin: async (userId) => ({ userId, role: 'owner' }),
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
  it('returns the catalog to signed-in clients', async () => {
    await withApp(routeService(), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/ai/catalog`, { headers: authHeaders });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { revision: 3, models: [] });
    });
  });

  it('returns a default preference when none is stored', async () => {
    await withApp(routeService(), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/ai/preferences/model`, { headers: authHeaders });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        selectedModelId: null, revision: 0, updatedAt: '',
      });
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

  it('maps optimistic revision conflicts to a safe current state', async () => {
    await withApp(routeService({
      updatePreference: async () => {
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
      const response = await fetch(`${baseUrl}/v1/ai/preferences/model`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ modelId: 'catalog-1' }),
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
});
