import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { createReadinessController } from '../readiness';
import { registerHealthRoutes } from '../routes/healthRoutes';

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
      probeAi: async () => {
        calls.count += 1;
        return true;
      },
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
          dependencies: { ai: true },
        });
      }
    });
    assert.equal(calls.count, 1);
  });

  it('returns a stable not-ready response when the AI probe is down', async () => {
    const controller = createReadinessController({
      probeAi: async () => false,
    });
    await controller.refresh();

    await withHealthServer(controller, async (baseUrl) => {
      const notReady = await fetch(`${baseUrl}/ready`);
      assert.equal(notReady.status, 503);
      assert.deepEqual(await notReady.json(), {
        status: 'not_ready',
        dependencies: { ai: false },
      });
    });
  });

  it('fails closed on probe errors without exposing private values', async () => {
    const controller = createReadinessController({
      probeAi: async () => {
        throw new Error('private AI key');
      },
    });
    await controller.refresh();
    assert.deepEqual(controller.getSnapshot(), { ai: false });
    assert.doesNotMatch(
      JSON.stringify(controller.getSnapshot()),
      /private|key|token|secret/i,
    );
  });
});
