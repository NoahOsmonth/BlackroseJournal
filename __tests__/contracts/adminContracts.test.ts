import * as adminContracts from '../../packages/ai-control-plane-contracts/src/admin';
import * as publicContracts from '../../packages/ai-control-plane-contracts/src';

describe('admin control-plane contracts', () => {
  test.each([
    'openai-chat-completions',
    'openai-responses',
    'anthropic-messages',
    'gemini-generate-content',
  ])('accepts the supported %s provider protocol', (protocol) => {
    expect(adminContracts.parseProviderProtocol(protocol)).toBe(protocol);
  });

  test('validates provider creation with credential input only on the admin entry point', () => {
    const request = {
      name: 'Managed Provider',
      protocol: 'openai-chat-completions',
      baseUrl: 'https://provider.example/v1',
      displayMetadata: { label: 'Provider' },
      discoveryConfig: { modelsPath: '/models' },
      credential: { secret: 'admin-supplied-key', label: 'primary' },
    };

    expect(adminContracts.parseCreateProviderRequest(request)).toEqual(request);
    expect(publicContracts).not.toHaveProperty('parseCreateProviderRequest');
    expect(publicContracts).not.toHaveProperty('parseProviderCredentialInput');
  });

  test('validates optimistic admin mutations', () => {
    const mutations: [((value: unknown) => unknown), unknown][] = [
      [
        adminContracts.parseUpdateProviderRequest,
        { expectedRevision: 2, name: 'Renamed', baseUrl: 'https://provider.example/v2' },
      ],
      [adminContracts.parseArchiveProviderRequest, { expectedRevision: 3 }],
      [
        adminContracts.parseRotateProviderCredentialRequest,
        { expectedRevision: 3, credential: { secret: 'replacement', label: 'rotated' } },
      ],
      [
        adminContracts.parsePublishCatalogModelRequest,
        {
          expectedRevision: 4,
          providerModelId: 'provider-model-1',
          label: 'Rosebud Managed',
          publicModelId: 'managed/model-1',
          capabilities: {
            streaming: true,
            tools: true,
            vision: false,
            jsonObject: true,
            jsonSchema: false,
          },
          contextWindow: 32768,
          sortOrder: 10,
          purpose: 'chat',
        },
      ],
      [adminContracts.parseArchiveCatalogModelRequest, { expectedRevision: 5 }],
      [
        adminContracts.parseUpdateRuntimeSettingsRequest,
        {
          expectedRevision: 6,
          flashRouteId: 'route-flash-1',
          maxInputBytes: 131072,
          maxOutputTokens: 2048,
          requestTimeoutMs: 60000,
        },
      ],
    ];

    for (const [parser, mutation] of mutations) {
      expect(parser(mutation)).toEqual(mutation);
    }
  });

  test('rejects unsupported protocols and plaintext credentials in admin provider responses', () => {
    expect(() => adminContracts.parseProviderProtocol('openai-compatible')).toThrow(
      'providerProtocol',
    );
    expect(() =>
      adminContracts.parseAdminProvider({
        id: 'provider-1',
        name: 'Provider',
        protocol: 'openai-responses',
        baseUrl: 'https://provider.example/v1',
        state: 'active',
        revision: 1,
        credential: 'plaintext-secret',
        createdAt: '2026-08-24T00:00:00.000Z',
        updatedAt: '2026-08-24T00:00:00.000Z',
      }),
    ).toThrow('adminProvider.credential: unexpected field');
  });
});
