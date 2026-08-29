export interface OmnirouteAdapterConfig {
  baseUrl: string;
  manageKey: string;
  timeoutMs?: number;
}

export class OmnirouteRequestError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `OmniRoute request failed (${status})`);
    this.name = 'OmnirouteRequestError';
    this.status = status;
    this.body = body;
  }
}

export type OmnirouteAdapter = ReturnType<typeof createOmnirouteAdapter>;

type JsonInit = { method: string; headers: Record<string, string>; body?: string };

async function request<T>(
  cfg: OmnirouteAdapterConfig,
  path: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs ?? 15_000);
  try {
    const init: JsonInit = {
      method,
      headers: {
        Authorization: `Bearer ${cfg.manageKey}`,
        'Content-Type': 'application/json',
      },
    };
    if (body !== undefined) init.body = JSON.stringify(body);
    let res: Response;
    try {
      res = await fetch(`${cfg.baseUrl.replace(/\/+$/, '')}${path}`, { ...init, signal: controller.signal });
    } catch {
      throw new OmnirouteRequestError(0, null, 'OmniRoute unreachable');
    }
    const parsed = await res.json().catch(() => null);
    if (!res.ok) throw new OmnirouteRequestError(res.status, parsed);
    return parsed as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * OmniRoute management endpoints wrap their lists in an envelope object
 * (`{connections:[...]}`, `{combos:[...]}`, `{keys:[...]}`) rather than a bare
 * array. Unwrap the known key, tolerating a bare-array response for backward
 * compatibility with older gateway versions.
 */
function unwrapArray(value: unknown, key: string): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'object' && value !== null) {
    const inner = (value as Record<string, unknown>)[key];
    if (Array.isArray(inner)) return inner;
  }
  return [];
}

export function createOmnirouteAdapter(cfg: OmnirouteAdapterConfig) {
  const req = <T>(path: string, method = 'GET', body?: unknown) =>
    request<T>(cfg, path, method, body);

  return {
    listProviders: () => req<unknown>('/api/providers').then((body) => unwrapArray(body, 'connections')),
    createProvider: (input: { provider: string; apiKey?: string; name: string }) =>
      req<unknown>('/api/providers', 'POST', input),
    testProvider: (id: string) => req<{ valid: boolean; latencyMs?: number }>(`/api/providers/${id}/test`, 'POST'),
    listCombos: () => req<unknown>('/api/combos').then((body) => unwrapArray(body, 'combos')),
    upsertCombo: (input: { id: string; models: string[] }) => req<unknown>('/api/combos', 'POST', input),
    listModels: () => req<unknown>('/api/models').then((body) => unwrapArray(body, 'models')),
    listKeys: () => req<unknown>('/api/keys').then((body) => unwrapArray(body, 'keys')),
    createKey: (input: { name: string; allowedModels?: string[] }) =>
      req<{ id: string; key: string }>('/api/keys', 'POST', input),
    updateKey: (id: string, patch: { allowedModels?: string[] }) =>
      req<unknown>(`/api/keys/${id}`, 'PATCH', patch),
    revokeKey: (id: string) => req<unknown>(`/api/keys/${id}`, 'DELETE'),
  };
}
