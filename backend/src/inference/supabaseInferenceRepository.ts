import type {
  ModelCapabilities,
  ProviderProtocol,
} from '../../../packages/ai-control-plane-contracts/src';
import type { StoredProviderCredential } from '../control/controlPlaneTypes';
import type {
  ManagedInferenceRepository,
  ManagedInferenceRouteBinding,
} from './managedInferenceTypes';

export interface SupabaseInferenceRepositoryOptions {
  restUrl: string;
  secretKey: string;
  fetcher?: typeof fetch;
}

export class SupabaseInferenceRepositoryError extends Error {
  constructor() {
    super('Managed inference repository is unavailable.');
    this.name = 'SupabaseInferenceRepositoryError';
  }
}

type Row = Record<string, unknown>;

function rows(value: unknown): Row[] {
  if (!Array.isArray(value) || !value.every((item) => (
    typeof item === 'object' && item !== null && !Array.isArray(item)
  ))) throw new SupabaseInferenceRepositoryError();
  return value as Row[];
}

function text(row: Row, key: string): string {
  if (typeof row[key] !== 'string') throw new SupabaseInferenceRepositoryError();
  return row[key] as string;
}

function positiveInteger(row: Row, key: string): number {
  const value = row[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new SupabaseInferenceRepositoryError();
  }
  return value;
}

function capabilities(value: unknown): ModelCapabilities {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new SupabaseInferenceRepositoryError();
  }
  const row = value as Record<string, unknown>;
  const keys = ['streaming', 'tools', 'vision', 'jsonObject', 'jsonSchema'] as const;
  if (keys.some((key) => typeof row[key] !== 'boolean')) {
    throw new SupabaseInferenceRepositoryError();
  }
  return {
    streaming: row.streaming as boolean,
    tools: row.tools as boolean,
    vision: row.vision as boolean,
    jsonObject: row.jsonObject as boolean,
    jsonSchema: row.jsonSchema as boolean,
  };
}

function decodeBytea(value: unknown): string {
  if (typeof value !== 'string' || !/^\\x[0-9a-f]+$/i.test(value)) {
    throw new SupabaseInferenceRepositoryError();
  }
  return Buffer.from(value.slice(2), 'hex').toString('base64url');
}

function credential(row: Row): StoredProviderCredential {
  return {
    version: 1,
    algorithm: 'A256GCM',
    keyVersion: positiveInteger(row, 'key_version'),
    nonce: decodeBytea(row.nonce),
    ciphertext: decodeBytea(row.ciphertext),
    authenticationTag: decodeBytea(row.authentication_tag),
  };
}

const PROTOCOLS: ProviderProtocol[] = [
  'openai-chat-completions',
  'openai-responses',
  'anthropic-messages',
  'gemini-generate-content',
];

export function createSupabaseInferenceRepository(
  options: SupabaseInferenceRepositoryOptions,
): ManagedInferenceRepository {
  const fetcher = options.fetcher ?? fetch;
  const baseUrl = options.restUrl.replace(/\/$/, '');

  const getRows = async (
    path: string,
    query: Readonly<Record<string, string>>,
    schema: 'public' | 'control' = 'public',
  ): Promise<Row[]> => {
    const url = new URL(`${baseUrl}/${path}`);
    Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    timer.unref();
    try {
      const response = await fetcher(url, {
        redirect: 'error',
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          apikey: options.secretKey,
          authorization: `Bearer ${options.secretKey}`,
          ...(schema === 'control' ? { 'accept-profile': 'control' } : {}),
        },
      });
      if (!response.ok) throw new SupabaseInferenceRepositoryError();
      const body = await response.text();
      if (Buffer.byteLength(body, 'utf8') > 512 * 1024) {
        throw new SupabaseInferenceRepositoryError();
      }
      return rows(JSON.parse(body) as unknown);
    } catch (error) {
      if (error instanceof SupabaseInferenceRepositoryError) throw error;
      throw new SupabaseInferenceRepositoryError();
    } finally {
      clearTimeout(timer);
    }
  };

  const one = async (
    path: string,
    query: Readonly<Record<string, string>>,
    schema: 'public' | 'control' = 'public',
  ): Promise<Row | null> => (await getRows(path, { ...query, limit: '1' }, schema))[0] ?? null;

  const writeUsage: ManagedInferenceRepository['appendUsage'] = async (input) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    timer.unref();
    try {
      const response = await fetcher(`${baseUrl}/usage_events`, {
        method: 'POST',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          apikey: options.secretKey,
          authorization: `Bearer ${options.secretKey}`,
          'content-profile': 'control',
          'content-type': 'application/json',
          prefer: 'return=minimal',
        },
        body: JSON.stringify({
          user_id: input.userId,
          route_id: input.routeId,
          status: input.status,
          input_tokens: input.inputTokens ?? null,
          output_tokens: input.outputTokens ?? null,
          latency_ms: Math.max(0, Math.floor(input.latencyMs)),
          error_code: input.errorCode ?? null,
        }),
      });
      if (!response.ok) throw new SupabaseInferenceRepositoryError();
    } catch (error) {
      if (error instanceof SupabaseInferenceRepositoryError) throw error;
      throw new SupabaseInferenceRepositoryError();
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    async resolveRoute(userId, purpose): Promise<ManagedInferenceRouteBinding | null> {
      let route: Row | null;
      let runtime: Row | null;
      if (purpose === 'chat') {
        const preference = await one('user_ai_preferences', {
          select: 'user_id,selected_model_id', user_id: `eq.${userId}`,
        });
        if (!preference || typeof preference.selected_model_id !== 'string') return null;
        route = await one('model_routes', {
          select: '*', catalog_model_id: `eq.${preference.selected_model_id}`,
          purpose: 'eq.chat', state: 'eq.active', order: 'priority.asc,id.asc',
        }, 'control');
        runtime = await one('runtime_settings', { select: '*', singleton: 'eq.true' }, 'control');
      } else {
        runtime = await one('runtime_settings', { select: '*', singleton: 'eq.true' }, 'control');
        if (!runtime || typeof runtime.active_flash_route_id !== 'string') return null;
        route = await one('model_routes', {
          select: '*', id: `eq.${runtime.active_flash_route_id}`,
          purpose: 'eq.flash', state: 'eq.active',
        }, 'control');
      }
      if (!route || !runtime) return null;
      const providerModel = await one('provider_models', {
        select: 'id,provider_id,upstream_model_id,state,capabilities',
        id: `eq.${text(route, 'provider_model_id')}`, state: 'eq.active',
      }, 'control');
      if (!providerModel) return null;
      const provider = await one('providers', {
        select: 'id,protocol,base_url,state',
        id: `eq.${text(providerModel, 'provider_id')}`, state: 'eq.active',
      }, 'control');
      if (!provider) return null;
      const protocol = text(provider, 'protocol');
      if (!PROTOCOLS.includes(protocol as ProviderProtocol)) {
        throw new SupabaseInferenceRepositoryError();
      }
      const secret = await one('provider_credentials', {
        select: 'key_version,nonce,ciphertext,authentication_tag',
        provider_id: `eq.${text(provider, 'id')}`,
      }, 'control');
      if (!secret) return null;
      return {
        routeId: text(route, 'id'),
        purpose,
        providerId: text(provider, 'id'),
        protocol: protocol as ProviderProtocol,
        baseUrl: text(provider, 'base_url'),
        modelId: text(providerModel, 'upstream_model_id'),
        capabilities: capabilities(providerModel.capabilities),
        credential: credential(secret),
        maxInputBytes: Math.min(
          positiveInteger(route, 'max_input_bytes'),
          positiveInteger(runtime, 'max_input_bytes'),
        ),
        maxOutputTokens: Math.min(
          positiveInteger(route, 'max_output_tokens'),
          positiveInteger(runtime, 'max_output_tokens'),
        ),
        requestTimeoutMs: Math.min(
          positiveInteger(route, 'request_timeout_ms'),
          positiveInteger(runtime, 'request_timeout_ms'),
        ),
      };
    },
    appendUsage: writeUsage,
  };
}
