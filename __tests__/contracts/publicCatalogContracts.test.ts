import { parseCatalogResponse } from '../../packages/ai-control-plane-contracts/src/public';

const safeCatalogResponse = () => ({
  revision: 7,
  models: [
    {
      id: 'catalog-model-1',
      label: 'Rosebud Chat',
      modelId: 'upstream/model-1',
      capabilities: {
        streaming: true,
        tools: true,
        vision: false,
        jsonObject: true,
        jsonSchema: false,
      },
      contextWindow: 32768,
      availability: 'available',
      sortOrder: 10,
      revision: 3,
      createdAt: '2026-08-24T00:00:00.000Z',
      updatedAt: '2026-08-24T01:00:00.000Z',
    },
  ],
});

describe('public catalog contracts', () => {
  test('accepts an authenticated-safe catalog response', () => {
    const response = safeCatalogResponse();

    expect(parseCatalogResponse(response)).toEqual(response);
  });

  test('rejects provider details in a public catalog row', () => {
    const response = safeCatalogResponse();
    const unsafeResponse = {
      ...response,
      models: [
        {
          ...response.models[0],
          providerId: 'provider-secret-route',
          providerBaseUrl: 'https://private-provider.example/v1',
        },
      ],
    };

    expect(() => parseCatalogResponse(unsafeResponse)).toThrow(
      'catalog.models[0].providerId: unexpected field',
    );
  });
});
