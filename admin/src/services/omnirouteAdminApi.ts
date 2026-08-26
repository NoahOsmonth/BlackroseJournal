import { AdminApiError } from './adminApi';

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** A provider row as surfaced by the OmniRoute management API via the BRJ proxy. */
export interface OmnirouteProvider {
  id: string;
  name: string;
  status: string;
}

export interface OmnirouteModel {
  modelId: string;
  label: string;
}

export interface OmniroutePublishedModel {
  modelId: string;
  label: string;
}

export interface OmnirouteStatus {
  enabled: boolean;
}

export interface UpdatePublishedModelsInput {
  upserts: OmniroutePublishedModel[];
  removes: string[];
}

export interface OmnirouteAdminClientOptions {
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
  return typeof nested.message === 'string'
    ? nested.message
    : typeof root.message === 'string' ? root.message : fallback;
}

function parseProvider(value: unknown): OmnirouteProvider {
  const row = record(value);
  const id = typeof row.id === 'string' ? row.id
    : typeof row.provider === 'string' ? row.provider : '';
  const name = typeof row.name === 'string' && row.name.length > 0 ? row.name : id;
  if (!id) throw new AdminApiError('OmniRoute returned a malformed provider.', 502, 'BAD_GATEWAY');
  return {
    id,
    name,
    status: typeof row.status === 'string' ? row.status : 'unknown',
  };
}

function parseModel(value: unknown): OmnirouteModel | null {
  if (typeof value === 'string') return { modelId: value, label: value };
  const row = record(value);
  const modelId = typeof row.modelId === 'string' ? row.modelId
    : typeof row.model === 'string' ? row.model
      : typeof row.id === 'string' ? row.id : '';
  if (!modelId) return null;
  const label = typeof row.label === 'string' && row.label.length > 0 ? row.label : modelId;
  return { modelId, label };
}

/**
 * Client for the Task 6 backend proxy under `/v1/admin/control/omniroute`.
 * The admin app never calls OmniRoute directly — all traffic is proxied by
 * the BRJ backend, which owns the manage key and the disconnect-only rules.
 */
export class OmnirouteAdminClient {
  private readonly baseUrl: string;
  private readonly getAccessToken: () => Promise<string | null>;
  private readonly fetcher: Fetcher;

  constructor(options: OmnirouteAdminClientOptions) {
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
    if (!response.ok) {
      const root = record(body);
      const nested = record(root.error);
      const code = typeof nested.code === 'string' ? nested.code : undefined;
      throw new AdminApiError(errorMessage(body, 'The OmniRoute request failed.'), response.status, code);
    }
    return body as T;
  }

  async getStatus(): Promise<OmnirouteStatus> {
    const response = await this.request<{ enabled: unknown }>('/v1/admin/control/omniroute/status');
    return { enabled: response.enabled === true };
  }

  async listProviders(): Promise<OmnirouteProvider[]> {
    const response = await this.request<{ providers: unknown[] }>(
      '/v1/admin/control/omniroute/providers',
    );
    return (Array.isArray(response.providers) ? response.providers : []).map(parseProvider);
  }

  testProvider(id: string): Promise<{ valid: boolean; latencyMs?: number }> {
    return this.request(
      `/v1/admin/control/omniroute/providers/test/${encodeURIComponent(id)}`,
      { method: 'POST' },
    );
  }

  /**
   * Disconnect-only teardown. The typed confirmation phrase must match
   * `DELETE PROVIDER <name>` exactly; the backend refuses anything else.
   * There is no hard delete — neither here nor on the server.
   */
  disconnectProvider(providerName: string): Promise<{ published: OmniroutePublishedModel[] }> {
    return this.request('/v1/admin/control/omniroute/providers/disconnect', {
      method: 'POST',
      body: JSON.stringify({
        providerName,
        confirmation: `DELETE PROVIDER ${providerName}`,
      }),
    });
  }

  async listModels(): Promise<{ models: OmnirouteModel[]; published: OmniroutePublishedModel[] }> {
    const response = await this.request<{ models: unknown[]; published: unknown[] }>(
      '/v1/admin/control/omniroute/models',
    );
    const models = (Array.isArray(response.models) ? response.models : [])
      .map((value) => parseModel(value))
      .filter((model): model is OmnirouteModel => model !== null);
    const published = (Array.isArray(response.published) ? response.published : [])
      .map((value) => record(value))
      .filter((row) => typeof row.modelId === 'string' && typeof row.label === 'string')
      .map((row) => ({ modelId: row.modelId as string, label: row.label as string }));
    return { models, published };
  }

  updatePublishedModels(
    input: UpdatePublishedModelsInput,
  ): Promise<{ published: OmniroutePublishedModel[] }> {
    return this.request('/v1/admin/control/omniroute/published-models', {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }
}
