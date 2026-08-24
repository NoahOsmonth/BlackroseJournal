import assert from 'node:assert/strict';
import http from 'node:http';
import { describe, it } from 'node:test';
import type { AccessTokenVerifier } from '../../auth/supabaseJwtVerifier';
import { createApp } from '../../app';
import { createReadinessController } from '../../readiness';
import { createHindsightMemoryGateway } from '../hindsightMemoryGateway';
import type { MemoryGatewayLogger } from '../hindsightMemoryGateway';
import type { MemoryGatewayConfig } from '../memoryConfig';

const alphaBank = 'v1_tq7xxyffb7onhvcyk3x3nmpv3ylpc43z3fjeiyp7g3urawricerq';
const betaBank = 'v1_ip7ai6ipvnzflnckf5eo2vobdb3kqqaerddvwzfigaxbjfzj45ga';
const bankKey = Buffer.from('0123456789abcdef0123456789abcdef');
const readiness = createReadinessController({ probeAi: async () => true });

interface SeenRequest {
  method: string;
  url: string;
  body: unknown;
}

async function withGateway(
  run: (baseUrl: string, seen: SeenRequest[]) => Promise<void>,
  options: {
    respond?: (request: SeenRequest, init?: RequestInit) => Promise<Response>;
    logger?: MemoryGatewayLogger;
    config?: Partial<MemoryGatewayConfig>;
  } = {},
): Promise<void> {
  const seen: SeenRequest[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const rawBody = typeof init?.body === 'string' ? init.body : '';
    const request = {
      method: init?.method ?? 'GET',
      url: String(input),
      body: rawBody ? JSON.parse(rawBody) as unknown : undefined,
    };
    seen.push(request);
    if (options.respond) return options.respond(request, init);
    return new Response(JSON.stringify({ ok: true, results: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const verifier: AccessTokenVerifier = {
    verify: async (token) => ({
      userId: token === 'alpha-token' ? 'user-alpha' : 'user-beta',
      role: 'authenticated',
    }),
  };
  const app = createApp({
    serverConfig: { port: 0, readiness, allowedOrigins: null },
    managedAccess: { verifier },
    memoryGateway: createHindsightMemoryGateway({
      baseUrl: 'http://hindsight.internal:8888',
      bankKey,
      bankKeyVersion: 1,
      requestTimeoutMs: options.config?.requestTimeoutMs ?? 1_000,
      maxResponseBytes: options.config?.maxResponseBytes ?? 64 * 1024,
    }, { fetcher, logger: options.logger }),
  });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    await run(`http://127.0.0.1:${address.port}`, seen);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => {
      if (error) reject(error); else resolve();
    }));
  }
}

function jsonHeaders(token: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  };
}

describe('authenticated memory gateway routes', () => {
  it('isolates two users across retain, recall, reflect, rebuild, and clear', async () => {
    await withGateway(async (baseUrl, seen) => {
      const retainBody = {
        content: 'alpha memory', documentId: 'a', createdAt: '2026-08-24T00:00:00.000Z',
      };
      const rebuildBody = { items: [{
        content: 'alpha memory', documentId: 'a', kind: 'journal',
        createdAt: '2026-08-24T00:00:00.000Z',
      }] };
      const responses = [];
      responses.push(await fetch(`${baseUrl}/v1/memory/retain`, {
          method: 'POST', headers: jsonHeaders('alpha-token'), body: JSON.stringify(retainBody),
      }));
      responses.push(await fetch(`${baseUrl}/v1/memory/recall`, {
          method: 'POST', headers: jsonHeaders('beta-token'), body: JSON.stringify({ query: 'memory', limit: 4 }),
      }));
      responses.push(await fetch(`${baseUrl}/v1/memory/reflect`, {
          method: 'POST', headers: jsonHeaders('alpha-token'), body: JSON.stringify({ query: 'pattern' }),
      }));
      responses.push(await fetch(`${baseUrl}/v1/memory/rebuild`, {
          method: 'POST', headers: jsonHeaders('alpha-token'), body: JSON.stringify(rebuildBody),
      }));
      responses.push(await fetch(`${baseUrl}/v1/memory`, {
          method: 'DELETE', headers: { authorization: 'Bearer beta-token' },
      }));
      assert.deepEqual(responses.map((response) => response.status), [200, 200, 200, 200, 200]);

      assert.deepEqual(seen.map(({ method, url }) => ({
        method,
        path: new URL(url).pathname,
      })), [
        { method: 'POST', path: `/v1/default/banks/${alphaBank}/memories` },
        { method: 'POST', path: `/v1/default/banks/${betaBank}/memories/recall` },
        { method: 'POST', path: `/v1/default/banks/${alphaBank}/reflect` },
        { method: 'DELETE', path: `/v1/default/banks/${alphaBank}/memories` },
        { method: 'POST', path: `/v1/default/banks/${alphaBank}/memories` },
        { method: 'DELETE', path: `/v1/default/banks/${betaBank}/memories` },
      ]);
      assert.equal(JSON.stringify(seen).includes('rosebud'), false);
    });
  });

  it('rejects client bank selectors at any nesting depth before contacting Hindsight', async () => {
    await withGateway(async (baseUrl, seen) => {
      const payloads = [
        { bank: 'rosebud', query: 'memory' },
        { query: 'memory', options: { bank_id: alphaBank } },
        { items: [{ content: 'memory', timestamp: 1, document_id: 'a', bankId: betaBank }] },
      ];

      for (const payload of payloads) {
        const response = await fetch(`${baseUrl}/v1/memory/recall`, {
          method: 'POST',
          headers: jsonHeaders('alpha-token'),
          body: JSON.stringify(payload),
        });
        assert.equal(response.status, 400);
      }
      const deleteResponse = await fetch(`${baseUrl}/v1/memory`, {
        method: 'DELETE',
        headers: jsonHeaders('alpha-token'),
        body: JSON.stringify({ bank: 'rosebud' }),
      });
      assert.equal(deleteResponse.status, 400);
      const queryResponse = await fetch(`${baseUrl}/v1/memory/recall?bank=rosebud`, {
        method: 'POST',
        headers: jsonHeaders('alpha-token'),
        body: JSON.stringify({ query: 'memory' }),
      });
      assert.equal(queryResponse.status, 400);
      assert.equal(seen.length, 0);
    });
  });

  it('rejects malformed and oversized operation payloads before contacting Hindsight', async () => {
    await withGateway(async (baseUrl, seen) => {
      const invalidCalls = [
        { path: 'recall', body: { query: '   ' } },
        { path: 'recall', body: { query: 'memory', limit: 51 } },
        { path: 'reflect', body: { query: 'x'.repeat(16_385) } },
        { path: 'retain', body: { content: '' } },
        {
          path: 'retain',
          body: { content: 'x'.repeat(65_537), createdAt: new Date(1).toISOString(), documentId: 'a' },
        },
        {
          path: 'retain',
          body: { content: 'memory', createdAt: 'not-a-date', documentId: 'a' },
        },
        { path: 'rebuild', body: { items: Array.from({ length: 501 }, (_, index) => ({
          content: 'memory', createdAt: new Date(1).toISOString(), documentId: String(index), kind: 'journal',
        })) } },
        { path: 'recall', body: { query: 'memory', provider_config: { model: 'ignored' } } },
      ];

      for (const call of invalidCalls) {
        const response = await fetch(`${baseUrl}/v1/memory/${call.path}`, {
          method: 'POST',
          headers: jsonHeaders('alpha-token'),
          body: JSON.stringify(call.body),
        });
        assert.equal(response.status, 400, call.path);
      }
      assert.equal(seen.length, 0);
    });
  });

  it('removes user and bank identifiers from responses and deep-redacts failure logs', async () => {
    const logs: unknown[] = [];
    const logger: MemoryGatewayLogger = {
      warn: (event, details) => logs.push({ event, details }),
    };
    await withGateway(async (baseUrl) => {
      const recall = await fetch(`${baseUrl}/v1/memory/recall`, {
        method: 'POST',
        headers: jsonHeaders('alpha-token'),
        body: JSON.stringify({ query: 'memory' }),
      });
      assert.equal(recall.status, 200);
      const responseText = await recall.text();
      assert.equal(responseText.includes(alphaBank), false);
      assert.equal(responseText.includes('user-alpha'), false);
      assert.doesNotMatch(responseText, /bank(?:_id)?|user_id/i);

      const reflect = await fetch(`${baseUrl}/v1/memory/reflect`, {
        method: 'POST',
        headers: jsonHeaders('alpha-token'),
        body: JSON.stringify({ query: 'pattern' }),
      });
      assert.equal(reflect.status, 503);
      assert.deepEqual(await reflect.json(), {
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Memory service is unavailable.' },
      });
    }, {
      logger,
      respond: async (request) => {
        if (request.url.endsWith('/reflect')) {
          throw new Error(`failed for user-alpha in ${alphaBank}`);
        }
        return new Response(JSON.stringify({
          bank_id: alphaBank,
          user_id: 'user-alpha',
          results: [{
            content: 'safe recalled content',
            metadata: { bank: alphaBank, ownerUserId: 'user-alpha' },
            diagnostic: `source=${alphaBank}; owner=user-alpha`,
          }],
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      },
    });
    const logsText = JSON.stringify(logs);
    assert.equal(logs.length, 1);
    assert.equal(logsText.includes(alphaBank), false);
    assert.equal(logsText.includes('user-alpha'), false);
  });

  it('bounds upstream response bytes and request duration with generic errors', async () => {
    await withGateway(async (baseUrl) => {
      const oversized = await fetch(`${baseUrl}/v1/memory/recall`, {
        method: 'POST',
        headers: jsonHeaders('alpha-token'),
        body: JSON.stringify({ query: 'memory' }),
      });
      assert.equal(oversized.status, 502);
      assert.deepEqual(await oversized.json(), {
        error: { code: 'BAD_GATEWAY', message: 'Memory service returned an invalid response.' },
      });
    }, {
      config: { maxResponseBytes: 32 },
      logger: { warn: () => undefined },
      respond: async () => new Response(JSON.stringify({ results: ['x'.repeat(256)] })),
    });

    await withGateway(async (baseUrl) => {
      const timedOut = await fetch(`${baseUrl}/v1/memory/reflect`, {
        method: 'POST',
        headers: jsonHeaders('alpha-token'),
        body: JSON.stringify({ query: 'pattern' }),
      });
      assert.equal(timedOut.status, 504);
      assert.deepEqual(await timedOut.json(), {
        error: { code: 'GATEWAY_TIMEOUT', message: 'Memory service timed out.' },
      });
    }, {
      config: { requestTimeoutMs: 10 },
      logger: { warn: () => undefined },
      respond: async (_request, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      }),
    });
  });
});
