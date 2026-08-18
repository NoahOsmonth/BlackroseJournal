import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import type { MemoryConfigResult } from '../memory/config';
import type {
  BootstrapState,
  MemoryRepository,
} from '../memory/repositories/memoryRepository';
import { createReadinessController } from '../readiness';
import { registerHealthRoutes } from '../routes/healthRoutes';

const readyConfig: MemoryConfigResult = {
  ready: true,
  config: {
    postgrestBaseUrl: 'https://project.supabase.co/rest/v1',
    postgrestServerKey: 'sb_secret_private',
    postgrestKeyKind: 'secret',
    deploymentId: 'blackrose-primary',
    writerEpoch: 7,
    writerLeaseId: '00000000-0000-4000-8000-000000000077',
    writerLeaseToken: 'private-writer-token',
    sourceCredentialFingerprint: 'sha256:source-a',
    mirrorWritesEnabled: true,
    auth: {
      supabaseUrl: 'https://project.supabase.co',
      supabasePublishableKey: 'publishable-key',
      timeoutMs: 100,
    },
  },
};

const validBootstrap: BootstrapState = {
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

function repositoryReturning(
  bootstrap: BootstrapState,
  calls: { count: number } = { count: 0 },
): MemoryRepository {
  return {
    async getBootstrap() {
      calls.count += 1;
      return bootstrap;
    },
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
}

async function withHealthServer(
  provider: ReturnType<typeof createReadinessController>,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const app = express();
  registerHealthRoutes(app, provider);
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

describe('cached readiness', () => {
  it('keeps liveness independent and serves only cached readiness booleans', async () => {
    const calls = { count: 0 };
    const controller = createReadinessController({
      probeAi: async () => true,
      memoryConfig: readyConfig,
      credentialFingerprint: 'sha256:source-a',
      repository: repositoryReturning(validBootstrap, calls),
      now: () => new Date('2026-07-28T00:00:00.000Z'),
    });
    await controller.refresh();
    assert.equal(calls.count, 1);

    await withHealthServer(controller, async (baseUrl) => {
      const health = await fetch(`${baseUrl}/health`);
      assert.equal(health.status, 200);
      assert.deepEqual(await health.json(), { status: 'ok' });

      for (let index = 0; index < 2; index += 1) {
        const ready = await fetch(`${baseUrl}/ready`);
        assert.equal(ready.status, 200);
        assert.deepEqual(await ready.json(), {
          status: 'ready',
          dependencies: {
            ai: true,
            supabaseAuth: true,
            postgrestGateway: true,
            deploymentAuthority: true,
          },
        });
      }
    });
    assert.equal(calls.count, 1);
  });

  it('returns a stable redacted not-ready response', async () => {
    const controller = createReadinessController({
      probeAi: async () => false,
      memoryConfig: {
        ready: false,
        dependencies: {
          supabaseAuth: true,
          postgrestGateway: false,
          deployment: false,
        },
      },
      repository: null,
    });
    await controller.refresh();

    await withHealthServer(controller, async (baseUrl) => {
      const notReady = await fetch(`${baseUrl}/ready`);
      assert.equal(notReady.status, 503);
      assert.deepEqual(await notReady.json(), {
        status: 'not_ready',
        dependencies: {
          ai: false,
          supabaseAuth: true,
          postgrestGateway: false,
          deploymentAuthority: false,
        },
      });
    });
  });

  it('rejects malformed, unprovisioned, inactive, or mismatched authority', async () => {
    const invalidAuthorities: BootstrapState[] = [
      { ...validBootstrap, deploymentId: 'other' },
      { ...validBootstrap, databaseFingerprint: 'phase0-unprovisioned:test' },
      { ...validBootstrap, mode: 'maintenance' },
      { ...validBootstrap, writerEpoch: 8 },
      { ...validBootstrap, writerLeaseId: null },
      { ...validBootstrap, writerLeaseId: '00000000-0000-4000-8000-000000000078' },
      { ...validBootstrap, writerLeaseExpiresAt: '2020-01-01T00:00:00.000Z' },
      { ...validBootstrap, writerLeaseIssuer: null },
      { ...validBootstrap, writerLeaseKeyId: null },
      { ...validBootstrap, sourceCredentialFingerprint: 'sha256:other' },
    ];
    for (const bootstrap of invalidAuthorities) {
      const controller = createReadinessController({
        probeAi: async () => true,
        memoryConfig: readyConfig,
        credentialFingerprint: 'sha256:source-a',
        repository: repositoryReturning(bootstrap),
        now: () => new Date('2026-07-28T00:00:00.000Z'),
      });
      await controller.refresh();
      assert.deepEqual(controller.getSnapshot(), {
        ai: true,
        supabaseAuth: true,
        postgrestGateway: true,
        deploymentAuthority: false,
      });
    }
  });

  it('compares the gateway-derived fingerprint, never the asserted config value', async () => {
    // The selected key derives to sha256:derived-b, but both the config's
    // asserted fingerprint and the hosted authority row name sha256:source-a.
    // A deployment that trusts the asserted value would pass; deriving from
    // the selected key must fail closed.
    const controller = createReadinessController({
      probeAi: async () => true,
      memoryConfig: readyConfig,
      credentialFingerprint: 'sha256:derived-b',
      repository: repositoryReturning(validBootstrap),
      now: () => new Date('2026-07-28T00:00:00.000Z'),
    });
    await controller.refresh();
    assert.deepEqual(controller.getSnapshot(), {
      ai: true,
      supabaseAuth: true,
      postgrestGateway: true,
      deploymentAuthority: false,
    });

    // When the derived fingerprint, the asserted value, and the hosted row all
    // agree, the authority is valid.
    const matching = createReadinessController({
      probeAi: async () => true,
      memoryConfig: readyConfig,
      credentialFingerprint: 'sha256:source-a',
      repository: repositoryReturning(validBootstrap),
      now: () => new Date('2026-07-28T00:00:00.000Z'),
    });
    await matching.refresh();
    assert.equal(matching.getSnapshot().deploymentAuthority, true);
  });

  it('fails closed on probe errors without exposing config or upstream values', async () => {
    const controller = createReadinessController({
      probeAi: async () => { throw new Error('private AI key'); },
      memoryConfig: readyConfig,
      credentialFingerprint: 'sha256:source-a',
      repository: {
        ...repositoryReturning(validBootstrap),
        async getBootstrap() { throw new Error('private upstream body'); },
      },
    });
    await controller.refresh();
    const serialized = JSON.stringify(controller.getSnapshot());
    assert.deepEqual(controller.getSnapshot(), {
      ai: false,
      supabaseAuth: true,
      postgrestGateway: false,
      deploymentAuthority: false,
    });
    assert.doesNotMatch(
      serialized,
      /private|writer-token|sb_secret|digest|source-a/i,
    );
  });
});
