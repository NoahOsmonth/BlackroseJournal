import assert from 'node:assert/strict';
import http from 'node:http';
import { describe, it } from 'node:test';
import { createApp } from '../../app';
import type { AccessTokenVerifier } from '../../auth/supabaseJwtVerifier';
import { createReadinessController } from '../../readiness';
import {
  isOmnirouteEnabled,
  type OmnirouteRouteIntegration,
} from '../../routes/managedInferenceRoutes';

const readiness = createReadinessController({ probeAi: async () => true });
const verifier: AccessTokenVerifier = {
  verify: async () => ({ userId: 'verified-user', role: 'authenticated' }),
};

const headers = {
  authorization: 'Bearer valid',
  origin: 'https://app.example',
  'content-type': 'application/json',
};

async function withApp(
  omniroute: OmnirouteRouteIntegration | undefined,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = http.createServer(createApp({
    serverConfig: { port: 0, readiness, allowedOrigins: ['https://app.example'] },
    managedAccess: { verifier },
    omnirouteInference: omniroute,
  }));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function makeIntegration(overrides: Partial<OmnirouteRouteIntegration> = {}): OmnirouteRouteIntegration & {
  calls: { ensureUserKey: unknown[][]; chat: unknown[][] };
} {
  const calls = { ensureUserKey: [] as unknown[][], chat: [] as unknown[][] };
  return {
    calls,
    enabled: true,
    publishedModels: async () => ['free-a', 'free-b'],
    ensureUserKey: async (userId: string, allowedModels: string[]) => {
      calls.ensureUserKey.push([userId, allowedModels]);
      return 'sk-user';
    },
    chat: async (req, signal) => {
      calls.chat.push([req, signal]);
      return new Response(JSON.stringify({ id: 'chatcmpl-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
    ...overrides,
  };
}

describe('omniroute chat route flag', () => {
  it('defaults to off', () => {
    assert.equal(isOmnirouteEnabled({}), false);
    assert.equal(isOmnirouteEnabled({ ADMIN_OMNIROUTE: 'off' }), false);
    assert.equal(isOmnirouteEnabled({ ADMIN_OMNIROUTE: 'on' }), true);
  });

  it('routes through the per-user OmniRoute key when the flag is on', async () => {
    const integration = makeIntegration();
    await withApp(integration, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/v1/ai/chat/completions`, {
        method: 'POST', headers,
        body: JSON.stringify({
          purpose: 'chat', messages: [{ role: 'user', content: 'Hi' }], stream: false,
        }),
      });
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { id: 'chatcmpl-1' });
      assert.deepEqual(integration.calls.ensureUserKey, [['verified-user', ['free-a', 'free-b']]]);
      const [chatReq] = integration.calls.chat[0] as [
        { userId: string; model: string; messages: unknown[] },
      ];
      assert.equal(chatReq.userId, 'verified-user');
      // model omitted in request -> defaults to first published (free) model
      assert.equal(chatReq.model, 'free-a');
    });
  });

  it('rejects models outside the published free set with 400', async () => {
    const integration = makeIntegration();
    await withApp(integration, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/v1/ai/chat/completions`, {
        method: 'POST', headers,
        body: JSON.stringify({
          purpose: 'chat', model: 'paid-model',
          messages: [{ role: 'user', content: 'Hi' }], stream: false,
        }),
      });
      assert.equal(res.status, 400);
      assert.equal(integration.calls.chat.length, 0);
    });
  });

  it('passes SSE responses through untouched', async () => {
    const integration = makeIntegration({
      chat: async () => new Response('data: {"x":1}\n\ndata: [DONE]\n\n', {
        status: 200,
        headers: { 'content-type': 'text/event-stream; charset=utf-8' },
      }),
    });
    await withApp(integration, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/v1/ai/chat/completions`, {
        method: 'POST', headers,
        body: JSON.stringify({
          purpose: 'chat', messages: [{ role: 'user', content: 'Hi' }], stream: true,
        }),
      });
      assert.equal(res.headers.get('content-type'), 'text/event-stream; charset=utf-8');
      assert.equal(await res.text(), 'data: {"x":1}\n\ndata: [DONE]\n\n');
    });
  });

  it('falls back to the legacy path when the flag is off', async () => {
    let touched = false;
    const integration = makeIntegration({
      enabled: false,
      chat: async () => {
        touched = true;
        throw new Error('should not be called');
      },
    });
    await withApp(integration, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/v1/ai/chat/completions`, {
        method: 'POST', headers,
        body: JSON.stringify({
          purpose: 'chat', messages: [{ role: 'user', content: 'Hi' }], stream: false,
        }),
      });
      // No managed inference service wired -> legacy path yields 503.
      assert.equal(res.status, 503);
      assert.equal(touched, false);
      assert.equal(integration.calls.chat.length, 0);
    });
  });
});
