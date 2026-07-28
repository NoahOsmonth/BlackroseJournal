import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { RequestHandler } from 'express';
import { createApp } from '../app';
import type { MemoryRepository } from '../memory/repositories/memoryRepository';

const ownerId = '00000000-0000-4000-8000-00000000000a';
const otherOwnerId = '00000000-0000-4000-8000-00000000000b';

describe('production app composition', () => {
  it('keeps Supabase memory auth separate from legacy agent auth', async () => {
    const seenOwners: string[] = [];
    const repository: MemoryRepository = {
      async getBootstrap() {
        return {
          deploymentId: 'blackrose-primary',
          writerEpoch: 7,
          mode: 'active',
          backendBaseUrl: 'https://api.example.test',
          databaseFingerprint: 'sha256:primary',
          writerLeaseId: '00000000-0000-4000-8000-000000000077',
          writerLeaseExpiresAt: '2099-07-28T00:00:00.000Z',
          writerLeaseIssuer: 'rosebud-operator',
          writerLeaseKeyId: 'operator-key-1',
          sourceCredentialFingerprint: 'sha256:source-a',
        };
      },
      async getOwnerState(id) {
        seenOwners.push(id);
        return {
          authorityState: 'MIRROR',
          authorityVersion: 4,
          featureFlags: {
            cloudSourceMirroring: true,
            cloudProjectionBuild: false,
            shadowRetrieval: false,
            cloudReadAuthority: false,
            cloudWriteAuthority: false,
          },
        };
      },
      async getSourceInventory(id) {
        seenOwners.push(id);
        return {
          conversationCount: 1,
          messageCount: 2,
          oldestAuthoredAt: null,
          newestAuthoredAt: null,
        };
      },
    };
    const memoryAuthMiddleware: RequestHandler = (req, res, next) => {
      if (req.headers.authorization !== 'Bearer valid-user-token') {
        res.status(401).json({ error: { code: 'MEMORY_AUTH_INVALID' } });
        return;
      }
      res.locals.memoryAuth = {
        ownerId,
        accessToken: 'valid-user-token',
      };
      next();
    };
    const app = createApp({
      serverConfig: {
        port: 0,
        allowedOrigins: null,
        agentApiKey: 'legacy-key',
      },
      memoryAuthMiddleware,
      memoryRepository: repository,
    });
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      const state = await fetch(
        `${baseUrl}/v1/memory/state?owner_id=${otherOwnerId}`,
        { headers: { authorization: 'Bearer valid-user-token' } },
      );
      assert.equal(state.status, 200);
      assert.equal(state.headers.get('cache-control'), 'no-store');
      const stateBody = await state.json();
      assert.equal(stateBody.data.ownerId, ownerId);
      assert.equal(stateBody.data.deploymentId, 'blackrose-primary');
      assert.equal(stateBody.data.writerEpoch, 7);
      assert.equal(stateBody.data.authorityVersion, 4);
      assert.equal(stateBody.data.authorityState, 'MIRROR');
      assert.deepEqual(seenOwners, [ownerId]);

      const forbiddenMemory = await fetch(`${baseUrl}/v1/memory/state`, {
        headers: { 'x-api-key': 'legacy-key' },
      });
      assert.equal(forbiddenMemory.status, 401);

      const forbiddenLegacy = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
      });
      assert.equal(forbiddenLegacy.status, 401);

      const bootstrapResponse = await fetch(`${baseUrl}/v1/memory/bootstrap`, {
        headers: { authorization: 'Bearer valid-user-token' },
      });
      assert.equal(bootstrapResponse.headers.get('cache-control'), 'no-store');
      const bootstrapBody = await bootstrapResponse.json();
      assert.equal(bootstrapBody.data.writerLeaseId, '00000000-0000-4000-8000-000000000077');
      assert.equal(bootstrapBody.data.writerLeaseIssuer, 'rosebud-operator');
      assert.equal(bootstrapBody.data.writerLeaseKeyId, 'operator-key-1');
      assert.equal(bootstrapBody.data.sourceCredentialFingerprint, 'sha256:source-a');
      assert.doesNotMatch(JSON.stringify(bootstrapBody), /token|digest/i);

      const inventoryResponse = await fetch(`${baseUrl}/v1/memory/inventory`, {
        headers: { authorization: 'Bearer valid-user-token' },
      });
      assert.equal(inventoryResponse.headers.get('cache-control'), 'no-store');
      assert.equal((await inventoryResponse.json()).data.ownerId, ownerId);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => {
        if (error) reject(error); else resolve();
      }));
    }
  });
});
