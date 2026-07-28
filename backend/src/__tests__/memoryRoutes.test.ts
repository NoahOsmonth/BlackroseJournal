import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express, { type RequestHandler } from 'express';
import http from 'node:http';
import {
  MemoryRepositoryError,
  type MemoryRepository,
} from '../memory/repositories/memoryRepository';
import { registerMemoryRoutes } from '../memory/routes/memoryRoutes';

const ownerId = '00000000-0000-4000-8000-00000000000a';
const bootstrap = {
  deploymentId: 'blackrose-primary',
  writerEpoch: 7,
  mode: 'active' as const,
  backendBaseUrl: 'https://api.example.test',
  databaseFingerprint: 'sha256:primary',
  writerLeaseId: '00000000-0000-4000-8000-000000000077',
  writerLeaseExpiresAt: '2099-07-28T00:00:00.000Z',
  writerLeaseIssuer: 'rosebud-operator',
  writerLeaseKeyId: 'operator-key-1',
  sourceCredentialFingerprint: 'sha256:source-a',
};

async function withServer(
  repository: MemoryRepository,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const app = express();
  const authMiddleware: RequestHandler = (_req, res, next) => {
    res.locals.memoryAuth = { ownerId, accessToken: 'token' };
    next();
  };
  registerMemoryRoutes(app, { authMiddleware, repository });
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

describe('memory routes', () => {
  it('returns a fail-closed LOCAL envelope for missing owner state', async () => {
    const repository: MemoryRepository = {
      async getBootstrap() { return bootstrap; },
      async getOwnerState() { return null; },
      async getSourceInventory() {
        return {
          conversationCount: 0,
          messageCount: 0,
          oldestAuthoredAt: null,
          newestAuthoredAt: null,
        };
      },
    };
    await withServer(repository, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/memory/state`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await response.json(), {
        data: {
          ownerId,
          deploymentId: 'blackrose-primary',
          writerEpoch: 7,
          authorityVersion: 0,
          authorityState: 'LOCAL',
          featureFlags: {
            cloudSourceMirroring: false,
            cloudProjectionBuild: false,
            shadowRetrieval: false,
            cloudReadAuthority: false,
            cloudWriteAuthority: false,
          },
        },
      });
    });
  });

  it('maps invalid authority separately from other unavailable data', async () => {
    for (const [code, expected] of [
      ['MEMORY_DATA_INVALID', 'MEMORY_AUTHORITY_UNAVAILABLE'],
      ['other', 'MEMORY_DATA_UNAVAILABLE'],
    ] as const) {
      const repository: MemoryRepository = {
        async getBootstrap() {
          if (code === 'MEMORY_DATA_INVALID') {
            throw new MemoryRepositoryError(code);
          }
          throw new Error('private upstream body');
        },
        async getOwnerState() { return null; },
        async getSourceInventory() {
          throw new Error('not used');
        },
      };
      await withServer(repository, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/v1/memory/bootstrap`);
        const body = await response.json() as {
          error: { code: string };
        };
        assert.equal(response.status, 503);
        assert.equal(body.error.code, expected);
        assert.doesNotMatch(JSON.stringify(body), /private upstream/i);
      });
    }
  });

  it('does not mislabel invalid owner state as deployment authority failure', async () => {
    const repository: MemoryRepository = {
      async getBootstrap() { return bootstrap; },
      async getOwnerState() {
        throw new MemoryRepositoryError('MEMORY_DATA_INVALID');
      },
      async getSourceInventory() {
        throw new Error('not used');
      },
    };
    await withServer(repository, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/memory/state`);
      assert.equal(response.status, 503);
      const body = await response.json() as {
        error: { code: string };
      };
      assert.equal(body.error.code, 'MEMORY_DATA_UNAVAILABLE');
    });
  });
});
