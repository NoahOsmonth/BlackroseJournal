import assert from 'node:assert/strict';
import http from 'node:http';
import { describe, it } from 'node:test';
import { createApp } from '../../app';
import type { AccessTokenVerifier } from '../../auth/supabaseJwtVerifier';
import { createReadinessController } from '../../readiness';
import type { ManagedInferenceRouteService } from '../../routes/managedInferenceRoutes';

const readiness = createReadinessController({ probeAi: async () => true });
const verifier: AccessTokenVerifier = {
  verify: async () => ({ userId: 'verified-user', role: 'authenticated' }),
};

async function withInferenceApp(
  execute: ManagedInferenceRouteService['execute'],
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const deps = {
    serverConfig: { port: 0, readiness, allowedOrigins: ['https://app.example'] },
    managedAccess: { verifier },
    managedInferenceService: { execute },
  };
  const server = http.createServer(createApp(deps));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => {
      if (error) reject(error); else resolve();
    }));
  }
}

const headers = {
  authorization: 'Bearer valid',
  origin: 'https://app.example',
  'content-type': 'application/json',
};

describe('managed inference routes', () => {
  it('returns normalized JSON events for a non-stream request bound to the verified user', async () => {
    let observedUser = '';
    await withInferenceApp((userId) => (async function* events() {
      observedUser = userId;
      yield { type: 'text_delta', text: 'hello' };
      yield { type: 'completion', reason: 'stop' };
    })(), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/ai/chat/completions`, {
        method: 'POST', headers,
        body: JSON.stringify({
          purpose: 'chat', messages: [{ role: 'user', content: 'Hi' }], stream: false,
        }),
      });
      assert.equal(response.status, 200);
      assert.equal(observedUser, 'verified-user');
      assert.deepEqual(await response.json(), { events: [
        { type: 'text_delta', text: 'hello' },
        { type: 'completion', reason: 'stop' },
      ] });
    });
  });

  it('streams normalized SSE events and terminates explicitly', async () => {
    await withInferenceApp(() => (async function* events() {
      yield { type: 'text_delta', text: 'one' };
      yield { type: 'text_delta', text: ' two' };
      yield { type: 'completion', reason: 'stop' };
    })(), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/ai/chat/completions`, {
        method: 'POST', headers,
        body: JSON.stringify({
          purpose: 'chat', messages: [{ role: 'user', content: 'Hi' }], stream: true,
        }),
      });
      const body = await response.text();
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/);
      assert.match(body, /data: \{"type":"text_delta","text":"one"\}/);
      assert.match(body, /data: \[DONE\]/);
    });
  });

  it('rejects malformed requests before inference and never echoes supplied secrets', async () => {
    let called = false;
    await withInferenceApp(() => {
      called = true;
      return (async function* events() {})();
    }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/ai/chat/completions`, {
        method: 'POST', headers,
        body: JSON.stringify({
          purpose: 'chat', messages: [], stream: false, apiKey: 'must-not-leak',
        }),
      });
      assert.equal(response.status, 400);
      assert.equal(called, false);
      assert.doesNotMatch(await response.text(), /must-not-leak/);
    });
  });

  it('propagates client cancellation into the active upstream execution', async () => {
    let observedAbort!: () => void;
    const aborted = new Promise<void>((resolve) => { observedAbort = resolve; });
    await withInferenceApp((_userId, _request, signal) => (async function* events() {
      yield { type: 'text_delta', text: 'started' };
      await new Promise<void>((resolve) => {
        if (signal?.aborted) resolve();
        else signal?.addEventListener('abort', () => resolve(), { once: true });
      });
      observedAbort();
    })(), async (baseUrl) => {
      const controller = new AbortController();
      const response = await fetch(`${baseUrl}/v1/ai/chat/completions`, {
        method: 'POST', headers, signal: controller.signal,
        body: JSON.stringify({
          purpose: 'chat', messages: [{ role: 'user', content: 'Hi' }], stream: true,
        }),
      });
      await response.body?.getReader().read();
      controller.abort();
      await Promise.race([
        aborted,
        new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('abort timeout')), 500)),
      ]);
    });
  });
});
