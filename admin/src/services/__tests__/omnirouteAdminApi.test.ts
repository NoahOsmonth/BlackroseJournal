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

describe('omniroute admin client', () => {
  it('reads the flag status through the backend proxy', async () => {
    const { client, calls } = clientWith(() => jsonResponse(200, { enabled: true, flag: 'on' }));
    expect(await client.getStatus()).toEqual({ enabled: true });
    expect(calls[0].url).toBe('https://gateway.example/v1/admin/control/omniroute/status');
    expect(new Headers(calls[0].init.headers).get('authorization')).toBe('Bearer token-1');
  });

  it('lists providers with defensive parsing', async () => {
    const { client } = clientWith(() => jsonResponse(200, {
      providers: [
        { id: 'p1', name: 'OpenRouter', status: 'connected' },
        { provider: 'fallback-id' },
      ],
    }));
    expect(await client.listProviders()).toEqual([
      { id: 'p1', name: 'OpenRouter', status: 'connected' },
      { id: 'fallback-id', name: 'fallback-id', status: 'unknown' },
    ]);
  });

  it('sends the exact typed confirmation on disconnect and never a DELETE', async () => {
    const { client, calls } = clientWith(() => jsonResponse(200, { published: [] }));
    await client.disconnectProvider('openrouter');
    expect(calls[0].url.endsWith('/providers/disconnect')).toBe(true);
    expect(calls[0].init.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      providerName: 'openrouter',
      confirmation: 'DELETE PROVIDER openrouter',
    });
  });

  it('parses free-only models plus the published allowlist', async () => {
    const { client } = clientWith(() => jsonResponse(200, {
      models: [{ id: 'free/a:free', label: 'Free A' }, { junk: true }, 'free/b:free'],
      published: [{ modelId: 'free/a:free', label: 'Free A' }],
    }));
    const { models, published } = await client.listModels();
    expect(models).toEqual([
      { modelId: 'free/a:free', label: 'Free A' },
      { modelId: 'free/b:free', label: 'free/b:free' },
    ]);
    expect(published).toEqual([{ modelId: 'free/a:free', label: 'Free A' }]);
  });

  it('surfaces CONFIRMATION_REQUIRED errors as AdminApiError', async () => {
    const { client } = clientWith(() => jsonResponse(400, {
      error: { code: 'CONFIRMATION_REQUIRED', message: 'Type the confirmation phrase exactly.' },
    }));
    await expect(client.disconnectProvider('openrouter')).rejects.toMatchObject({
      name: 'AdminApiError',
      status: 400,
      code: 'CONFIRMATION_REQUIRED',
    } satisfies Partial<AdminApiError>);
  });
});
