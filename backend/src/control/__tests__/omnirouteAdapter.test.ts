import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { createOmnirouteAdapter, OmnirouteRequestError } from '../omnirouteAdapter';

const originalFetch = globalThis.fetch;

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status < 400,
    status,
    json: async () => body,
  } as unknown as Response;
}

type FetchCall = { url: string; init: RequestInit };

function installFetchMock(handler: (url: string, init: RequestInit) => Promise<Response>): FetchCall[] {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init: init ?? {} });
    return handler(url, init ?? {});
  }) as typeof fetch;
  return calls;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('omniroute adapter', () => {
  it('sends bearer header and parses JSON', async () => {
    const calls = installFetchMock(async () => jsonResponse(200, []));
    const adapter = createOmnirouteAdapter({ baseUrl: 'http://x', manageKey: 'k' });
    const result = await adapter.listProviders();
    assert.deepEqual(result, []);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'http://x/api/providers');
    const headers = new Headers(calls[0].init.headers);
    assert.equal(headers.get('authorization'), 'Bearer k');
  });

  it('maps non-2xx JSON errors to OmnirouteRequestError with status', async () => {
    installFetchMock(async () => jsonResponse(403, { error: 'AUTH' }));
    const adapter = createOmnirouteAdapter({ baseUrl: 'http://x', manageKey: 'k' });
    await assert.rejects(
      () => adapter.listProviders(),
      (err: unknown) => {
        assert.ok(err instanceof OmnirouteRequestError);
        assert.equal((err as OmnirouteRequestError).status, 403);
        assert.deepEqual((err as OmnirouteRequestError).body, { error: 'AUTH' });
        return true;
      },
    );
  });

  it('maps network rejection to status-0 error', async () => {
    installFetchMock(async () => {
      throw new TypeError('fetch failed');
    });
    const adapter = createOmnirouteAdapter({ baseUrl: 'http://x', manageKey: 'k' });
    await assert.rejects(
      () => adapter.listProviders(),
      (err: unknown) => {
        assert.ok(err instanceof OmnirouteRequestError);
        assert.equal((err as OmnirouteRequestError).status, 0);
        return true;
      },
    );
  });

  it('revokeKey issues DELETE to /api/keys/<id>', async () => {
    const calls = installFetchMock(async () => jsonResponse(200, { ok: true }));
    const adapter = createOmnirouteAdapter({ baseUrl: 'http://x', manageKey: 'k' });
    await adapter.revokeKey('key-9');
    assert.equal(calls[0].url, 'http://x/api/keys/key-9');
    assert.equal(calls[0].init.method, 'DELETE');
  });

  it('createProvider posts to /api/providers with bearer header', async () => {
    const calls = installFetchMock(async () => jsonResponse(200, { id: 'p1' }));
    const adapter = createOmnirouteAdapter({ baseUrl: 'http://x/', manageKey: 'k' });
    await adapter.createProvider({ provider: 'openrouter', name: 'OpenRouter', apiKey: 'sk-a' });
    assert.equal(calls[0].url, 'http://x/api/providers');
    assert.equal(calls[0].init.method, 'POST');
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
      provider: 'openrouter',
      name: 'OpenRouter',
      apiKey: 'sk-a',
    });
    const headers = new Headers(calls[0].init.headers);
    assert.equal(headers.get('authorization'), 'Bearer k');
  });

  it('testProvider posts to /api/providers/<id>/test', async () => {
    const calls = installFetchMock(async () => jsonResponse(200, { valid: true, latencyMs: 42 }));
    const adapter = createOmnirouteAdapter({ baseUrl: 'http://x', manageKey: 'k' });
    const result = await adapter.testProvider('prov-1');
    assert.deepEqual(result, { valid: true, latencyMs: 42 });
    assert.equal(calls[0].url, 'http://x/api/providers/prov-1/test');
    assert.equal(calls[0].init.method, 'POST');
  });

  it('listCombos and upsertCombo hit /api/combos', async () => {
    const calls = installFetchMock(async (_url, init) =>
      jsonResponse(200, init.method === 'POST' ? { id: 'combo-1' } : []),
    );
    const adapter = createOmnirouteAdapter({ baseUrl: 'http://x', manageKey: 'k' });
    assert.deepEqual(await adapter.listCombos(), []);
    await adapter.upsertCombo({ id: 'combo-1', models: ['a', 'b'] });
    assert.equal(calls[0].url, 'http://x/api/combos');
    assert.equal(calls[1].init.method, 'POST');
    assert.deepEqual(JSON.parse(String(calls[1].init.body)), { id: 'combo-1', models: ['a', 'b'] });
  });

  it('keys CRUD hits /api/keys with correct verbs', async () => {
    const calls = installFetchMock(async (_url, init) => {
      if (init.method === 'POST') return jsonResponse(200, { id: 'key1', key: 'sk-full' });
      if (init.method === 'PATCH') return jsonResponse(200, { id: 'key1' });
      if (init.method === 'GET') return jsonResponse(200, [{ id: 'key1' }]);
      return jsonResponse(200, { ok: true });
    });
    const adapter = createOmnirouteAdapter({ baseUrl: 'http://x', manageKey: 'k' });
    assert.deepEqual(await adapter.createKey({ name: 'brj-u1', allowedModels: ['m'] }), {
      id: 'key1',
      key: 'sk-full',
    });
    await adapter.updateKey('key1', { allowedModels: [] });
    await adapter.listKeys();
    assert.equal(calls[0].url, 'http://x/api/keys');
    assert.equal(calls[0].init.method, 'POST');
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), { name: 'brj-u1', allowedModels: ['m'] });
    assert.equal(calls[1].url, 'http://x/api/keys/key1');
    assert.equal(calls[1].init.method, 'PATCH');
    assert.equal(calls[2].url, 'http://x/api/keys');
    assert.equal(calls[2].init.method, 'GET');
  });

  it('aborts at timeoutMs and surfaces a request error', async () => {
    installFetchMock(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const adapter = createOmnirouteAdapter({ baseUrl: 'http://x', manageKey: 'k', timeoutMs: 20 });
    await assert.rejects(
      () => adapter.listProviders(),
      (err: unknown) => {
        assert.ok(err instanceof OmnirouteRequestError);
        assert.equal((err as OmnirouteRequestError).status, 0);
        return true;
      },
    );
  });

  it('unwraps the OmniRoute envelope for listProviders ({connections:[...]})', async () => {
    const connection = { id: 'prov-1', name: 'main' };
    installFetchMock(async () => jsonResponse(200, { connections: [connection] }));
    const adapter = createOmnirouteAdapter({ baseUrl: 'http://x', manageKey: 'k' });
    assert.deepEqual(await adapter.listProviders(), [connection]);
  });

  it('unwraps the OmniRoute envelope for listCombos ({combos:[...]})', async () => {
    const combo = { id: 'combo-1', models: [] };
    installFetchMock(async () => jsonResponse(200, { combos: [combo] }));
    const adapter = createOmnirouteAdapter({ baseUrl: 'http://x', manageKey: 'k' });
    assert.deepEqual(await adapter.listCombos(), [combo]);
  });

  it('unwraps the OmniRoute envelope for listKeys ({keys:[...]})', async () => {
    const key = { id: 'key1' };
    installFetchMock(async () => jsonResponse(200, { keys: [key] }));
    const adapter = createOmnirouteAdapter({ baseUrl: 'http://x', manageKey: 'k' });
    assert.deepEqual(await adapter.listKeys(), [key]);
  });

  it('unwraps the OmniRoute envelope for listModels ({models:[...]})', async () => {
    const model = { fullModel: 'cl/tencent/hy3:free' };
    const calls = installFetchMock(async () => jsonResponse(200, { models: [model] }));
    const adapter = createOmnirouteAdapter({ baseUrl: 'http://x', manageKey: 'k' });
    assert.deepEqual(await adapter.listModels(), [model]);
    assert.equal(calls[0].url, 'http://x/api/models');
  });

  it('tolerates a missing envelope key by returning an empty array', async () => {
    installFetchMock(async () => jsonResponse(200, { other: 'thing' }));
    const adapter = createOmnirouteAdapter({ baseUrl: 'http://x', manageKey: 'k' });
    assert.deepEqual(await adapter.listProviders(), []);
  });

  it('tolerates non-JSON error bodies', async () => {
    installFetchMock(async () =>
      ({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError('not json');
        },
      }) as unknown as Response,
    );
    const adapter = createOmnirouteAdapter({ baseUrl: 'http://x', manageKey: 'k' });
    await assert.rejects(
      () => adapter.listProviders(),
      (err: unknown) => {
        assert.ok(err instanceof OmnirouteRequestError);
        assert.equal((err as OmnirouteRequestError).status, 502);
        assert.equal((err as OmnirouteRequestError).body, null);
        return true;
      },
    );
  });
});
