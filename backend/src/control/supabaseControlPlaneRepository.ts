import type { UpdateModelPreferenceRequest } from '../../../packages/ai-control-plane-contracts/src';
import type {
  CreateProviderRequest,
  UpdateRuntimeSettingsRequest,
} from '../../../packages/ai-control-plane-contracts/src/admin';
import {
  ControlPlaneRepositoryConflictError,
  type ControlPlaneRepository,
} from './controlPlaneService';
import type {
  AuditEventInput,
  AuditEventRecord,
  CatalogResponse,
  DiscoveredProviderModel,
  FlashRouteInput,
  ModelCapabilities,
  ModelRouteRecord,
  ProviderModelRecord,
  ProviderRecord,
  PublicCatalogModel,
  RuntimeSettingsRecord,
  UserAiPreference,
} from './controlPlaneTypes';

export interface SupabaseControlPlaneRepositoryOptions {
  restUrl: string;
  secretKey: string;
  fetcher?: typeof fetch;
}

export class SupabaseControlRepositoryError extends Error {
  constructor(message = 'Control plane repository is unavailable.') {
    super(message);
    this.name = 'SupabaseControlRepositoryError';
  }
}

export class SupabaseControlRepositoryConflictError extends ControlPlaneRepositoryConflictError {
  constructor() {
    super();
    this.name = 'SupabaseControlRepositoryConflictError';
  }
}

type SchemaName = 'public' | 'control';

interface RestRequest {
  method?: string;
  schema?: SchemaName;
  query?: Readonly<Record<string, string>>;
  body?: unknown;
  prefer?: string;
  allowEmpty?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  const candidate = Array.isArray(value) && value.length === 1 ? value[0] : value;
  if (!isRecord(candidate)) throw new SupabaseControlRepositoryError();
  return candidate;
}

function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || !value.every(isRecord)) {
    throw new SupabaseControlRepositoryError();
  }
  return value;
}

function stringField(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== 'string') throw new SupabaseControlRepositoryError();
  return value;
}

function numberField(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new SupabaseControlRepositoryError();
  }
  return value;
}

function optionalPositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function capabilities(value: unknown): ModelCapabilities {
  if (!isRecord(value)) throw new SupabaseControlRepositoryError();
  const keys = ['streaming', 'tools', 'vision', 'jsonObject', 'jsonSchema'] as const;
  if (keys.some((key) => typeof value[key] !== 'boolean')) {
    throw new SupabaseControlRepositoryError();
  }
  return {
    streaming: value.streaming as boolean,
    tools: value.tools as boolean,
    vision: value.vision as boolean,
    jsonObject: value.jsonObject as boolean,
    jsonSchema: value.jsonSchema as boolean,
  };
}

function providerRecord(row: Record<string, unknown>): ProviderRecord {
  const protocol = stringField(row, 'protocol');
  const state = stringField(row, 'state');
  if (![
    'openai-chat-completions', 'openai-responses', 'anthropic-messages',
    'gemini-generate-content',
  ].includes(protocol)) throw new SupabaseControlRepositoryError();
  if (!['active', 'disabled', 'archived'].includes(state)) {
    throw new SupabaseControlRepositoryError();
  }
  const display = row.display_metadata;
  const discovery = row.discovery_config;
  return {
    id: stringField(row, 'id'),
    name: stringField(row, 'name'),
    protocol: protocol as ProviderRecord['protocol'],
    baseUrl: stringField(row, 'base_url'),
    state: state as ProviderRecord['state'],
    revision: numberField(row, 'revision'),
    ...(isRecord(display) && typeof display.label === 'string'
      ? { displayMetadata: {
        label: display.label,
        ...(typeof display.description === 'string' ? { description: display.description } : {}),
      } }
      : {}),
    ...(isRecord(discovery) && typeof discovery.modelsPath === 'string'
      ? { discoveryConfig: { modelsPath: discovery.modelsPath } }
      : {}),
    createdAt: stringField(row, 'created_at'),
    updatedAt: stringField(row, 'updated_at'),
  };
}

function providerModelRecord(row: Record<string, unknown>): ProviderModelRecord {
  const state = stringField(row, 'state');
  if (!['active', 'disabled', 'archived'].includes(state)) {
    throw new SupabaseControlRepositoryError();
  }
  const contextWindow = optionalPositiveInteger(row.context_window);
  return {
    id: stringField(row, 'id'),
    providerId: stringField(row, 'provider_id'),
    upstreamModelId: stringField(row, 'upstream_model_id'),
    label: stringField(row, 'label'),
    capabilities: capabilities(row.capabilities),
    ...(contextWindow ? { contextWindow } : {}),
    rawSafeMetadata: isRecord(row.raw_safe_metadata) ? row.raw_safe_metadata : {},
    state: state as ProviderModelRecord['state'],
    revision: numberField(row, 'revision'),
    discoveredAt: stringField(row, 'discovered_at'),
    updatedAt: stringField(row, 'updated_at'),
  };
}

function catalogModel(row: Record<string, unknown>): PublicCatalogModel {
  const availability = stringField(row, 'availability');
  if (!['available', 'degraded', 'unavailable'].includes(availability)) {
    throw new SupabaseControlRepositoryError();
  }
  return {
    id: stringField(row, 'id'),
    label: stringField(row, 'label'),
    publicModelId: stringField(row, 'public_model_id'),
    capabilities: capabilities(row.capabilities),
    contextWindow: numberField(row, 'context_window'),
    availability: availability as PublicCatalogModel['availability'],
    sortOrder: numberField(row, 'sort_order'),
    revision: numberField(row, 'revision'),
    createdAt: stringField(row, 'created_at'),
    updatedAt: stringField(row, 'updated_at'),
  };
}

function runtimeSettings(row: Record<string, unknown>): RuntimeSettingsRecord {
  return {
    activeFlashRouteId: row.active_flash_route_id === null
      ? null
      : stringField(row, 'active_flash_route_id'),
    maxInputBytes: numberField(row, 'max_input_bytes'),
    maxOutputTokens: numberField(row, 'max_output_tokens'),
    requestTimeoutMs: numberField(row, 'request_timeout_ms'),
    revision: numberField(row, 'revision'),
    updatedAt: stringField(row, 'updated_at'),
  };
}

function preference(row: Record<string, unknown>): UserAiPreference {
  return {
    selectedModelId: row.selected_model_id === null
      ? null
      : stringField(row, 'selected_model_id'),
    revision: numberField(row, 'revision'),
    updatedAt: stringField(row, 'updated_at'),
  };
}

function routeRecord(row: Record<string, unknown>): ModelRouteRecord {
  const purpose = stringField(row, 'purpose');
  const state = stringField(row, 'state');
  if (!['chat', 'flash'].includes(purpose) || !['active', 'disabled', 'archived'].includes(state)) {
    throw new SupabaseControlRepositoryError();
  }
  return {
    id: stringField(row, 'id'),
    providerModelId: stringField(row, 'provider_model_id'),
    ...(typeof row.catalog_model_id === 'string' ? { catalogModelId: row.catalog_model_id } : {}),
    purpose: purpose as ModelRouteRecord['purpose'],
    state: state as ModelRouteRecord['state'],
    priority: numberField(row, 'priority'),
    maxInputBytes: numberField(row, 'max_input_bytes'),
    maxOutputTokens: numberField(row, 'max_output_tokens'),
    requestTimeoutMs: numberField(row, 'request_timeout_ms'),
    revision: numberField(row, 'revision'),
  };
}

function byteaFromBase64Url(value: string): string {
  return `\\x${Buffer.from(value, 'base64url').toString('hex')}`;
}

function base64UrlFromBytea(value: unknown): string {
  if (typeof value !== 'string' || !/^\\x[0-9a-f]*$/i.test(value)) {
    throw new SupabaseControlRepositoryError();
  }
  return Buffer.from(value.slice(2), 'hex').toString('base64url');
}

function providerBody(input: Omit<CreateProviderRequest, 'credential'>): Record<string, unknown> {
  return {
    name: input.name,
    protocol: input.protocol,
    base_url: input.baseUrl,
    display_metadata: input.displayMetadata ?? {},
    discovery_config: input.discoveryConfig ?? {},
  };
}

export function createSupabaseControlPlaneRepository(
  options: SupabaseControlPlaneRepositoryOptions,
): ControlPlaneRepository {
  const fetcher = options.fetcher ?? fetch;
  const baseUrl = options.restUrl.replace(/\/$/, '');
  const baseHeaders = {
    accept: 'application/json',
    apikey: options.secretKey,
    authorization: `Bearer ${options.secretKey}`,
  };

  const request = async (path: string, options: RestRequest = {}): Promise<unknown> => {
    const url = new URL(`${baseUrl}/${path.replace(/^\//, '')}`);
    Object.entries(options.query ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));
    const headers: Record<string, string> = { ...baseHeaders };
    if (options.schema === 'control') {
      headers['accept-profile'] = 'control';
      if (options.method && options.method !== 'GET') headers['content-profile'] = 'control';
    }
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (options.prefer) headers.prefer = options.prefer;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    timer.unref();
    try {
      const response = await fetcher(url, {
        method: options.method ?? 'GET',
        redirect: 'error',
        signal: controller.signal,
        headers,
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      });
      const text = await response.text();
      if (Buffer.byteLength(text, 'utf8') > 4 * 1024 * 1024) {
        throw new SupabaseControlRepositoryError();
      }
      if (!response.ok) {
        if (response.status === 409 || /PT409|REVISION_CONFLICT/.test(text)) {
          throw new SupabaseControlRepositoryConflictError();
        }
        throw new SupabaseControlRepositoryError();
      }
      if (!text) return options.allowEmpty ? null : [];
      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw new SupabaseControlRepositoryError();
      }
    } catch (error) {
      if (error instanceof SupabaseControlRepositoryError) throw error;
      throw new SupabaseControlRepositoryError();
    } finally {
      clearTimeout(timer);
    }
  };

  const single = async (
    path: string,
    rest: RestRequest,
    onEmpty: 'null' | 'conflict' = 'null',
  ): Promise<Record<string, unknown> | null> => {
    const rows = records(await request(path, rest));
    if (rows.length === 0) {
      if (onEmpty === 'conflict') throw new SupabaseControlRepositoryConflictError();
      return null;
    }
    return rows[0];
  };

  return {
    async listProviders() {
      const rows = records(await request('providers', {
        schema: 'control',
        query: { select: '*', order: 'created_at.asc,id.asc' },
      }));
      return rows.map(providerRecord);
    },

    async getProvider(id) {
      const row = await single('providers', {
        schema: 'control',
        query: { select: '*', id: `eq.${id}`, limit: '1' },
      });
      return row ? providerRecord(row) : null;
    },

    async createProvider(input) {
      const row = await single('providers', {
        method: 'POST',
        schema: 'control',
        body: providerBody(input),
        prefer: 'return=representation',
      });
      if (!row) throw new SupabaseControlRepositoryError();
      return providerRecord(row);
    },

    async updateProvider(id, input) {
      const body: Record<string, unknown> = {};
      if (input.name !== undefined) body.name = input.name;
      if (input.baseUrl !== undefined) body.base_url = input.baseUrl;
      if (input.state !== undefined) body.state = input.state;
      if (input.displayMetadata !== undefined) body.display_metadata = input.displayMetadata;
      if (input.discoveryConfig !== undefined) body.discovery_config = input.discoveryConfig;
      const row = await single('providers', {
        method: 'PATCH',
        schema: 'control',
        query: { id: `eq.${id}`, revision: `eq.${input.expectedRevision}` },
        body,
        prefer: 'return=representation',
      }, 'conflict');
      return providerRecord(row as Record<string, unknown>);
    },

    async archiveProvider(id, expectedRevision) {
      return providerRecord(record(await request('rpc/archive_provider', {
        method: 'POST',
        schema: 'control',
        body: { p_provider_id: id, p_expected_revision: expectedRevision },
      })));
    },

    async getProviderCredential(providerId) {
      const row = await single('provider_credentials', {
        schema: 'control',
        query: { select: '*', provider_id: `eq.${providerId}`, limit: '1' },
      });
      if (!row) return null;
      return {
        version: 1,
        algorithm: 'A256GCM',
        keyVersion: numberField(row, 'key_version'),
        nonce: base64UrlFromBytea(row.nonce),
        ciphertext: base64UrlFromBytea(row.ciphertext),
        authenticationTag: base64UrlFromBytea(row.authentication_tag),
        ...(typeof row.label === 'string' ? { label: row.label } : {}),
        ...(typeof row.last_four === 'string' ? { lastFour: row.last_four } : {}),
        updatedAt: stringField(row, 'updated_at'),
      };
    },

    async replaceProviderCredential(providerId, credential, expectedProviderRevision) {
      let revisedProvider: ProviderRecord | undefined;
      if (expectedProviderRevision !== undefined) {
        const providerRow = await single('providers', {
          method: 'PATCH',
          schema: 'control',
          query: { id: `eq.${providerId}`, revision: `eq.${expectedProviderRevision}` },
          body: { updated_at: new Date().toISOString() },
          prefer: 'return=representation',
        }, 'conflict');
        revisedProvider = providerRecord(providerRow as Record<string, unknown>);
      }
      await request('provider_credentials', {
        method: 'POST',
        schema: 'control',
        query: { on_conflict: 'provider_id' },
        body: {
          provider_id: providerId,
          ciphertext: byteaFromBase64Url(credential.ciphertext),
          nonce: byteaFromBase64Url(credential.nonce),
          authentication_tag: byteaFromBase64Url(credential.authenticationTag),
          key_version: credential.keyVersion,
          label: credential.label ?? null,
          last_four: credential.lastFour ?? null,
        },
        prefer: 'resolution=merge-duplicates,return=minimal',
        allowEmpty: true,
      });
      return revisedProvider;
    },

    async listProviderModels(providerId) {
      const rows = records(await request('provider_models', {
        schema: 'control',
        query: { select: '*', provider_id: `eq.${providerId}`, order: 'label.asc,id.asc' },
      }));
      return rows.map(providerModelRecord);
    },

    async getProviderModel(id) {
      const row = await single('provider_models', {
        schema: 'control',
        query: { select: '*', id: `eq.${id}`, limit: '1' },
      });
      return row ? providerModelRecord(row) : null;
    },

    async replaceDiscoveredModels(
      providerId,
      models: readonly DiscoveredProviderModel[],
      expectedProviderRevision,
    ) {
      await single('providers', {
        method: 'PATCH',
        schema: 'control',
        query: { id: `eq.${providerId}`, revision: `eq.${expectedProviderRevision}`, state: 'eq.active' },
        body: { updated_at: new Date().toISOString() },
        prefer: 'return=representation',
      }, 'conflict');
      const existing = await this.listProviderModels(providerId);
      if (models.length > 0) {
        await request('provider_models', {
          method: 'POST',
          schema: 'control',
          query: { on_conflict: 'provider_id,upstream_model_id' },
          body: models.map((model) => ({
            provider_id: providerId,
            upstream_model_id: model.upstreamModelId,
            label: model.label,
            capabilities: model.capabilities,
            context_window: model.contextWindow ?? null,
            raw_safe_metadata: model.rawSafeMetadata,
            state: 'active',
            discovered_at: new Date().toISOString(),
          })),
          prefer: 'resolution=merge-duplicates,return=minimal',
          allowEmpty: true,
        });
      }
      const discoveredIds = new Set(models.map((model) => model.upstreamModelId));
      for (const stale of existing.filter((item) => (
        item.state === 'active' && !discoveredIds.has(item.upstreamModelId)
      ))) {
        await request('provider_models', {
          method: 'PATCH',
          schema: 'control',
          query: { id: `eq.${stale.id}` },
          body: { state: 'disabled' },
          prefer: 'return=minimal',
          allowEmpty: true,
        });
      }
      return this.listProviderModels(providerId);
    },

    async archiveProviderModel(id, expectedRevision) {
      return providerModelRecord(record(await request('rpc/archive_provider_model', {
        method: 'POST',
        schema: 'control',
        body: { p_provider_model_id: id, p_expected_revision: expectedRevision },
      })));
    },

    async getCatalog(): Promise<CatalogResponse> {
      const revisionRow = await single('ai_catalog_revision', {
        query: { select: 'revision', singleton: 'eq.true', limit: '1' },
      });
      if (!revisionRow) throw new SupabaseControlRepositoryError();
      const models = records(await request('ai_catalog_models', {
        query: { select: '*', order: 'sort_order.asc,id.asc' },
      })).map(catalogModel);
      return { revision: numberField(revisionRow, 'revision'), models };
    },

    async publishCatalogModel(providerId, input, expectedCatalogRevision) {
      return catalogModel(record(await request('rpc/publish_catalog_model', {
        method: 'POST',
        schema: 'control',
        body: {
          p_provider_id: providerId,
          p_provider_model_id: input.providerModelId,
          p_expected_provider_revision: input.expectedRevision,
          p_expected_catalog_revision: expectedCatalogRevision,
          p_label: input.label,
          p_public_model_id: input.publicModelId,
          p_capabilities: input.capabilities,
          p_context_window: input.contextWindow,
          p_sort_order: input.sortOrder,
          p_purpose: input.purpose,
        },
      })));
    },

    async archiveCatalogModel(id, expectedRevision) {
      return catalogModel(record(await request('rpc/archive_catalog_model', {
        method: 'POST',
        schema: 'control',
        body: { p_catalog_model_id: id, p_expected_revision: expectedRevision },
      })));
    },

    async getPreference(userId) {
      const row = await single('user_ai_preferences', {
        query: { select: '*', user_id: `eq.${userId}`, limit: '1' },
      });
      return row ? preference(row) : null;
    },

    async updatePreference(userId, input: UpdateModelPreferenceRequest) {
      const current = await this.getPreference(userId);
      if (input.expectedRevision !== undefined && current?.revision !== input.expectedRevision) {
        throw new SupabaseControlRepositoryConflictError();
      }
      const row = current
        ? await single('user_ai_preferences', {
          method: 'PATCH',
          query: { user_id: `eq.${userId}`, revision: `eq.${current.revision}` },
          body: { selected_model_id: input.modelId },
          prefer: 'return=representation',
        }, 'conflict')
        : await single('user_ai_preferences', {
          method: 'POST',
          body: { user_id: userId, selected_model_id: input.modelId },
          prefer: 'return=representation',
        });
      if (!row) throw new SupabaseControlRepositoryError();
      return preference(row);
    },

    async getRuntimeSettings() {
      const row = await single('runtime_settings', {
        schema: 'control',
        query: { select: '*', singleton: 'eq.true', limit: '1' },
      });
      if (!row) throw new SupabaseControlRepositoryError();
      return runtimeSettings(row);
    },

    async updateRuntimeSettings(input: UpdateRuntimeSettingsRequest) {
      const row = await single('runtime_settings', {
        method: 'PATCH',
        schema: 'control',
        query: { singleton: 'eq.true', revision: `eq.${input.expectedRevision}` },
        body: {
          active_flash_route_id: input.flashRouteId,
          max_input_bytes: input.maxInputBytes,
          max_output_tokens: input.maxOutputTokens,
          request_timeout_ms: input.requestTimeoutMs,
        },
        prefer: 'return=representation',
      }, 'conflict');
      return runtimeSettings(row as Record<string, unknown>);
    },

    async createFlashRoute(providerModelId, input: FlashRouteInput) {
      const model = await single('provider_models', {
        schema: 'control',
        query: {
          select: 'id', id: `eq.${providerModelId}`,
          revision: `eq.${input.expectedModelRevision}`, state: 'eq.active', limit: '1',
        },
      }, 'conflict');
      if (!model) throw new SupabaseControlRepositoryConflictError();
      const row = await single('model_routes', {
        method: 'POST',
        schema: 'control',
        query: { on_conflict: 'catalog_model_id,provider_model_id,purpose' },
        body: {
          catalog_model_id: null,
          provider_model_id: providerModelId,
          purpose: 'flash',
          state: 'active',
          priority: input.priority ?? 0,
          max_input_bytes: input.maxInputBytes,
          max_output_tokens: input.maxOutputTokens,
          request_timeout_ms: input.requestTimeoutMs,
        },
        prefer: 'resolution=merge-duplicates,return=representation',
      });
      if (!row) throw new SupabaseControlRepositoryError();
      return routeRecord(row);
    },

    async appendAudit(event: AuditEventInput) {
      await request('audit_events', {
        method: 'POST',
        schema: 'control',
        body: {
          actor_user_id: event.actorUserId,
          action: event.action,
          resource_type: event.resourceType,
          resource_id: event.resourceId ?? null,
          before_metadata: event.beforeMetadata ?? null,
          after_metadata: event.afterMetadata ?? null,
        },
        prefer: 'return=minimal',
        allowEmpty: true,
      });
    },

    async listAuditEvents(limit: number): Promise<readonly AuditEventRecord[]> {
      const boundedLimit = Math.max(1, Math.min(Math.floor(limit), 500));
      const rows = records(await request('audit_events', {
        schema: 'control',
        query: { select: '*', order: 'created_at.desc,id.desc', limit: String(boundedLimit) },
      }));
      return rows.map((row) => ({
        id: numberField(row, 'id'),
        actorUserId: row.actor_user_id === null ? null : stringField(row, 'actor_user_id'),
        action: stringField(row, 'action'),
        resourceType: stringField(row, 'resource_type'),
        ...(typeof row.resource_id === 'string' ? { resourceId: row.resource_id } : {}),
        ...(isRecord(row.before_metadata) ? { beforeMetadata: row.before_metadata } : {}),
        ...(isRecord(row.after_metadata) ? { afterMetadata: row.after_metadata } : {}),
        createdAt: stringField(row, 'created_at'),
      }));
    },
  };
}
