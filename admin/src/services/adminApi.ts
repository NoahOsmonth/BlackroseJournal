import type {
  AdminProvider,
  AuditEvent,
  CatalogResponse,
  CreateProviderRequest,
  FlashRouteInput,
  ModelRoute,
  ProviderCredentialInput,
  ProviderHealth,
  ProviderModelInventoryItem,
  ProviderModelRecord,
  PublicCatalogModel,
  PublishCatalogModelRequest,
  RuntimeSettings,
  UpdateProviderRequest,
  UpdateRuntimeSettingsRequest,
} from './adminTypes';
import {
  parseCatalogResponse,
  parsePublicCatalogModel,
} from '../../../packages/ai-control-plane-contracts/src';
import {
  parseAdminProvider,
  parseDiscoverProviderResponse,
} from '../../../packages/ai-control-plane-contracts/src/admin';

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

export class RevisionConflictError<TState> extends Error {
  readonly name = 'RevisionConflictError';

  constructor(
    message: string,
    readonly currentRevision: number,
    readonly currentState: TState,
  ) {
    super(message);
  }
}

export interface AdminControlPlaneClientOptions {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  fetcher?: Fetcher;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function errorMessage(body: unknown, fallback: string): string {
  const root = record(body);
  const nested = record(root.error);
  return typeof root.message === 'string'
    ? root.message
    : typeof nested.message === 'string'
      ? nested.message
      : fallback;
}

export class AdminControlPlaneClient {
  private readonly baseUrl: string;
  private readonly getAccessToken: () => Promise<string | null>;
  private readonly fetcher: Fetcher;

  constructor(options: AdminControlPlaneClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.getAccessToken = options.getAccessToken;
    this.fetcher = options.fetcher ?? fetch;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) throw new AdminApiError('Your session has expired.', 401, 'UNAUTHORIZED');
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
    const body: unknown = await response.json().catch(() => null);
    if (response.status === 409) {
      const conflict = record(body);
      throw new RevisionConflictError(
        errorMessage(body, 'This resource changed in another admin session.'),
        typeof conflict.currentRevision === 'number' ? conflict.currentRevision : 0,
        conflict.currentState,
      );
    }
    if (!response.ok) {
      const root = record(body);
      const nested = record(root.error);
      const code = typeof nested.code === 'string'
        ? nested.code
        : typeof root.code === 'string' ? root.code : undefined;
      throw new AdminApiError(errorMessage(body, 'The admin request failed.'), response.status, code);
    }
    return body as T;
  }

  async listProviders(): Promise<AdminProvider[]> {
    const response = await this.request<{ providers: unknown[] }>('/v1/admin/providers');
    return response.providers.map(parseAdminProvider);
  }

  async getProvider(id: string): Promise<AdminProvider> {
    return parseAdminProvider(await this.request(`/v1/admin/providers/${encodeURIComponent(id)}`));
  }

  async createProvider(input: CreateProviderRequest): Promise<AdminProvider> {
    return parseAdminProvider(await this.request('/v1/admin/providers', {
      method: 'POST', body: JSON.stringify(input),
    }));
  }

  async updateProvider(id: string, input: UpdateProviderRequest): Promise<AdminProvider> {
    return parseAdminProvider(await this.request(`/v1/admin/providers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }));
  }

  async archiveProvider(id: string, expectedRevision: number): Promise<AdminProvider> {
    return parseAdminProvider(await this.request(
      `/v1/admin/providers/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
      body: JSON.stringify({ expectedRevision }),
      },
    ));
  }

  replaceCredential(
    id: string,
    expectedRevision: number,
    credential: ProviderCredentialInput,
  ): Promise<AdminProvider> {
    return this.request(`/v1/admin/providers/${encodeURIComponent(id)}/credential`, {
      method: 'PUT',
      body: JSON.stringify({ expectedRevision, credential }),
    }).then(parseAdminProvider);
  }

  discoverProvider(id: string, expectedRevision: number): Promise<ProviderModelInventoryItem[]> {
    return this.request<unknown>(`/v1/admin/providers/${encodeURIComponent(id)}/discover`, {
      method: 'POST',
      body: JSON.stringify({ expectedRevision }),
    }).then((response) => parseDiscoverProviderResponse(response).models);
  }

  async listProviderModels(id: string): Promise<ProviderModelRecord[]> {
    const response = await this.request<{ models: ProviderModelRecord[] }>(
      `/v1/admin/providers/${encodeURIComponent(id)}/models`,
    );
    return response.models;
  }

  getProviderHealth(id: string): Promise<ProviderHealth> {
    return this.request(`/v1/admin/providers/${encodeURIComponent(id)}/health`);
  }

  async getCatalog(): Promise<CatalogResponse> {
    return parseCatalogResponse(await this.request('/v1/ai/catalog'));
  }

  publishModel(
    providerId: string,
    modelId: string,
    expectedCatalogRevision: number,
    input: PublishCatalogModelRequest,
  ): Promise<PublicCatalogModel> {
    const query = new URLSearchParams({
      expectedCatalogRevision: String(expectedCatalogRevision),
    });
    return this.request(
      `/v1/admin/providers/${encodeURIComponent(providerId)}/models/` +
      `${encodeURIComponent(modelId)}/publish?${query.toString()}`,
      { method: 'POST', body: JSON.stringify(input) },
    ).then((response) => parsePublicCatalogModel(response));
  }

  archiveCatalogModel(id: string, expectedRevision: number): Promise<PublicCatalogModel> {
    return this.request(`/v1/admin/catalog/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
      body: JSON.stringify({ expectedRevision }),
    }).then((response) => parsePublicCatalogModel(response));
  }

  archiveProviderModel(id: string, expectedRevision: number): Promise<ProviderModelRecord> {
    return this.request(`/v1/admin/provider-models/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
      body: JSON.stringify({ expectedRevision }),
    });
  }

  createFlashRoute(id: string, input: FlashRouteInput): Promise<ModelRoute> {
    return this.request(`/v1/admin/provider-models/${encodeURIComponent(id)}/routes/flash`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  getRuntime(): Promise<RuntimeSettings> {
    return this.request('/v1/admin/runtime');
  }

  updateRuntime(input: UpdateRuntimeSettingsRequest): Promise<RuntimeSettings> {
    return this.request('/v1/admin/runtime', { method: 'PATCH', body: JSON.stringify(input) });
  }

  async listAudit(limit = 100): Promise<AuditEvent[]> {
    const response = await this.request<{ events: AuditEvent[] }>(
      `/v1/admin/audit?limit=${encodeURIComponent(String(limit))}`,
    );
    return response.events;
  }
}
