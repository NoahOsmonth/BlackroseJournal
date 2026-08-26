import { AdminApiError } from '../adminApi';
import { OmnirouteAdminClient } from '../omnirouteAdminApi';

type FetchCall = { url: string; init: RequestInit };

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status < 400,
    status,
    json: async () => body,
  } as unknown as Response;
}

function clientWith(handler: (call: FetchCall) => Response): {
  client: OmnirouteAdminClient;
  calls: FetchCall[];
} {
  const calls: FetchCall[] = [];
  const client = new OmnirouteAdminClient({
    baseUrl: 'https://gateway.example/',
    getAccessToken: async () => 'token-1',
    fetcher: async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const call: FetchCall = { url, init: init ?? {} };
      calls.push(call);
      return handler(call);
    },
  });
  return { client, calls };
}

describe('omniroute admin client (Task 7 endpoints)', () => {
  it('fetches a masked user key and returns null for missing keys', async () => {
    const { client } = clientWith(() =>
      jsonResponse(200, { key: { userId: 'u1', omnirouteKeyId: 'k1', maskedKey: 'sk-1••••7890', allowedModels: ['a:free'], revokedAt: null } }));
    expect(await client.getUserKey('u1')).toEqual({
      userId: 'u1', omnirouteKeyId: 'k1', maskedKey: 'sk-1••••7890', allowedModels: ['a:free'], revokedAt: null,
    });

    const missing = clientWith(() => jsonResponse(200, { key: null })).client;
    expect(await missing.getUserKey('nobody')).toBeNull();
  });

  it('PATCHes allowed models via PUT and revokes via POST', async () => {
    const { client, calls } = clientWith(() => jsonResponse(200, { ok: true }));
    await client.setKeyAllowedModels('u1', ['a:free']);
    expect(calls[0].url).toContain('/keys/u1/allowed-models');
    expect(calls[0].init.method).toBe('PUT');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ allowedModels: ['a:free'] });

    await client.revokeUserKey('u1');
    expect(calls[1].url).toContain('/keys/u1/revoke');
    expect(calls[1].init.method).toBe('POST');
  });

  it('parses usage rows defensively', async () => {
    const { client } = clientWith(() => jsonResponse(200, {
      usage: [
        { keyName: 'brj-u1', requests: 5, totalTokens: 120 },
        { keyName: '' }, // dropped
        {},
      ],
    }));
    expect(await client.listUsage()).toEqual([{ keyName: 'brj-u1', requests: 5, totalTokens: 120 }]);
  });

  it('reads and writes embeddings settings', async () => {
    let current: unknown = { embeddingModel: 'e:free' };
    const { client, calls } = clientWith(() => jsonResponse(200, current));
    expect(await client.getEmbeddingsSettings()).toEqual({ embeddingModel: 'e:free' });
    current = { embeddingModel: null };
    expect(await client.setEmbeddingsSettings(null)).toEqual({ embeddingModel: null });
    expect(calls[1].init.method).toBe('PUT');
    expect(JSON.parse(String(calls[1].init.body))).toEqual({ embeddingModel: null });
  });

  it('surfaces backend validation errors as AdminApiError', async () => {
    const { client } = clientWith(() =>
      jsonResponse(400, { error: { code: 'INVALID_REQUEST', message: 'Model x is not a free model.' } }));
    await expect(client.setKeyAllowedModels('u1', ['paid/model'])).rejects.toThrow(AdminApiError);
  });
});
