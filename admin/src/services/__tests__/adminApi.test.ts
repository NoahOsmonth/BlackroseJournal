import { AdminApiError, AdminControlPlaneClient, RevisionConflictError } from '../adminApi';

const provider = {
  id: 'provider-1',
  name: 'Primary OpenAI',
  protocol: 'openai-chat-completions' as const,
  baseUrl: 'https://api.example.com/v1',
  state: 'active' as const,
  revision: 3,
  credentialMetadata: {
    label: 'production',
    lastFour: '7890',
    keyVersion: 2,
    updatedAt: '2026-08-24T00:00:00.000Z',
  },
  createdAt: '2026-08-24T00:00:00.000Z',
  updatedAt: '2026-08-24T00:00:00.000Z',
};

describe('AdminControlPlaneClient', () => {
  it('authenticates requests and never exposes a saved plaintext credential', async () => {
    const fetcher = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.headers).toEqual(expect.objectContaining({
        Authorization: 'Bearer admin-token',
        'Content-Type': 'application/json',
      }));
      expect(JSON.parse(String(init?.body))).toEqual({
        expectedRevision: 3,
        credential: { secret: 'sk-super-secret', label: 'production' },
      });
      return new Response(JSON.stringify(provider), { status: 200 });
    });
    const client = new AdminControlPlaneClient({
      baseUrl: 'https://gateway.example/',
      getAccessToken: async () => 'admin-token',
      fetcher,
    });

    const saved = await client.replaceCredential('provider-1', 3, {
      secret: 'sk-super-secret',
      label: 'production',
    });

    expect(saved.credentialMetadata?.lastFour).toBe('7890');
    expect(JSON.stringify(saved)).not.toContain('sk-super-secret');
    expect(fetcher).toHaveBeenCalledWith(
      'https://gateway.example/v1/admin/providers/provider-1/credential',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('surfaces stale writes with the server revision and current state', async () => {
    const fetcher = jest.fn(async () => new Response(JSON.stringify({
      code: 'revision_conflict',
      message: 'The resource changed before this mutation was applied.',
      currentRevision: 4,
      currentState: { ...provider, revision: 4 },
    }), { status: 409 }));
    const client = new AdminControlPlaneClient({
      baseUrl: 'https://gateway.example',
      getAccessToken: async () => 'admin-token',
      fetcher,
    });

    await expect(client.archiveProvider('provider-1', 3)).rejects.toEqual(
      expect.objectContaining<Partial<RevisionConflictError<unknown>>>({
        name: 'RevisionConflictError',
        currentRevision: 4,
      }),
    );
  });

  it('distinguishes an authenticated non-admin from an expired session', async () => {
    const responses = [
      new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Denied' } }), {
        status: 403,
      }),
      new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Expired' } }), {
        status: 401,
      }),
    ];
    const client = new AdminControlPlaneClient({
      baseUrl: 'https://gateway.example',
      getAccessToken: async () => 'admin-token',
      fetcher: jest.fn(async () => responses.shift() as Response),
    });

    await expect(client.listProviders()).rejects.toEqual(
      expect.objectContaining<Partial<AdminApiError>>({ status: 403 }),
    );
    await expect(client.listProviders()).rejects.toEqual(
      expect.objectContaining<Partial<AdminApiError>>({ status: 401 }),
    );
  });
});
