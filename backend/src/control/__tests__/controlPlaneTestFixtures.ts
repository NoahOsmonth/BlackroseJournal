import type { MasterKeyProvider } from '../../security/envelopeEncryption';
import type { ControlPlaneRepository } from '../controlPlaneService';
import type {
  ProviderModelRecord,
  ProviderRecord,
  RuntimeSettingsRecord,
} from '../controlPlaneTypes';

export const provider: ProviderRecord = {
  id: 'provider-1',
  name: 'OpenAI-compatible',
  protocol: 'openai-chat-completions',
  baseUrl: 'https://models.example/v1',
  state: 'active',
  revision: 1,
  displayMetadata: { label: 'Example' },
  discoveryConfig: { modelsPath: '/models' },
  createdAt: '2026-08-24T00:00:00.000Z',
  updatedAt: '2026-08-24T00:00:00.000Z',
};

export const model: ProviderModelRecord = {
  id: 'provider-model-1',
  providerId: provider.id,
  upstreamModelId: 'model-a',
  label: 'Model A',
  capabilities: {
    streaming: true,
    tools: true,
    vision: false,
    jsonObject: true,
    jsonSchema: false,
  },
  contextWindow: 32_768,
  rawSafeMetadata: {},
  state: 'active',
  revision: 1,
  discoveredAt: '2026-08-24T00:00:00.000Z',
  updatedAt: '2026-08-24T00:00:00.000Z',
};

const runtime: RuntimeSettingsRecord = {
  activeFlashRouteId: null,
  maxInputBytes: 1_048_576,
  maxOutputTokens: 8_192,
  requestTimeoutMs: 120_000,
  revision: 1,
  updatedAt: '2026-08-24T00:00:00.000Z',
};

export function repositoryStub(
  overrides: Partial<ControlPlaneRepository> = {},
): ControlPlaneRepository {
  return {
    listProviders: async () => [provider],
    getProvider: async () => provider,
    createProvider: async () => provider,
    updateProvider: async () => provider,
    archiveProvider: async () => provider,
    getProviderCredential: async () => null,
    replaceProviderCredential: async () => undefined,
    listProviderModels: async () => [model],
    getProviderModel: async () => model,
    replaceDiscoveredModels: async () => [model],
    archiveProviderModel: async () => model,
    getCatalog: async () => ({ revision: 1, models: [] }),
    publishCatalogModel: async () => ({
      id: 'catalog-1', label: 'Model A', publicModelId: 'managed/model-a',
      capabilities: model.capabilities, contextWindow: 32_768, availability: 'available',
      sortOrder: 0, revision: 2, createdAt: '2026-08-24T00:00:00.000Z',
      updatedAt: '2026-08-24T00:00:00.000Z',
    }),
    archiveCatalogModel: async () => { throw new Error('unused'); },
    getPreference: async () => null,
    updatePreference: async () => ({
      selectedModelId: 'catalog-1', revision: 1, updatedAt: '2026-08-24T00:00:00.000Z',
    }),
    getRuntimeSettings: async () => runtime,
    updateRuntimeSettings: async () => runtime,
    createFlashRoute: async () => ({
      id: 'flash-route-1', providerModelId: model.id, purpose: 'flash', state: 'active',
      priority: 0, maxInputBytes: 1_048_576, maxOutputTokens: 8_192,
      requestTimeoutMs: 120_000, revision: 1,
    }),
    appendAudit: async () => undefined,
    listAuditEvents: async () => [],
    ...overrides,
  };
}

export const masterKeys: MasterKeyProvider = {
  getCurrentKey: async () => ({ version: 3, key: Buffer.alloc(32, 7) }),
  getKey: async (version) => version === 3 ? Buffer.alloc(32, 7) : null,
};
