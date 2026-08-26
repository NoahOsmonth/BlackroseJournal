import { requestSafeHttps, type SafeTransportResponse } from '../security/safeTransport';
import type {
  DiscoveredProviderModel,
  ModelCapabilities,
  ProviderRecord,
} from './controlPlaneTypes';

export interface ProviderDiscoveryDependencies {
  request?: (
    url: string,
    options: {
      method?: string;
      headers?: Readonly<Record<string, string>>;
      timeoutMs?: number;
      maxResponseBytes?: number;
      maxRedirects?: number;
      maxCrossOriginRedirects?: number;
    },
  ) => Promise<SafeTransportResponse>;
}

export class ProviderDiscoveryError extends Error {
  constructor(message = 'Provider discovery failed.') {
    super(message);
    this.name = 'ProviderDiscoveryError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalPositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function capabilityFlag(record: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const capabilities = isRecord(record.capabilities) ? record.capabilities : {};
  return typeof capabilities[key] === 'boolean' ? capabilities[key] : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function capabilitiesFor(
  provider: ProviderRecord,
  record: Record<string, unknown>,
): ModelCapabilities {
  const geminiMethods = Array.isArray(record.supportedGenerationMethods)
    ? record.supportedGenerationMethods.filter((item): item is string => typeof item === 'string')
    : [];
  if (provider.protocol === 'gemini-generate-content') {
    return {
      streaming: geminiMethods.includes('streamGenerateContent') || geminiMethods.includes('generateContent'),
      tools: true,
      vision: true,
      jsonObject: true,
      jsonSchema: true,
    };
  }
  if (provider.protocol === 'anthropic-messages') {
    return {
      streaming: true,
      tools: true,
      vision: capabilityFlag(record, 'vision', true),
      jsonObject: false,
      jsonSchema: false,
    };
  }
  // OpenRouter-style inventories advertise features via `supported_parameters`
  // (e.g. ["tools", "tool_choice", "response_format"]) and `architecture.input_modalities`
  // instead of a `capabilities` object; honor those signals before falling back.
  const supportedParameters = stringArray(record.supported_parameters);
  const inputModalities = stringArray(
    isRecord(record.architecture) ? record.architecture.input_modalities : undefined,
  );
  return {
    streaming: capabilityFlag(record, 'streaming', true),
    tools: capabilityFlag(record, 'tools', supportedParameters.includes('tools')),
    vision: capabilityFlag(record, 'vision', inputModalities.includes('image')),
    jsonObject: capabilityFlag(record, 'jsonObject', supportedParameters.includes('response_format')),
    jsonSchema: capabilityFlag(record, 'jsonSchema', supportedParameters.includes('structured_outputs')),
  };
}

function parseOpenAiLike(
  provider: ProviderRecord,
  body: Record<string, unknown>,
): DiscoveredProviderModel[] {
  if (!Array.isArray(body.data)) throw new ProviderDiscoveryError('Provider inventory is invalid.');
  return body.data.flatMap((value): DiscoveredProviderModel[] => {
    if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) return [];
    const label = typeof value.name === 'string'
      ? value.name
      : typeof value.display_name === 'string'
        ? value.display_name
        : value.id;
    const contextWindow = optionalPositiveInteger(value.context_window);
    return [{
      upstreamModelId: value.id,
      label,
      capabilities: capabilitiesFor(provider, value),
      ...(contextWindow ? { contextWindow } : {}),
      rawSafeMetadata: {},
    }];
  });
}

function parseGemini(
  provider: ProviderRecord,
  body: Record<string, unknown>,
): DiscoveredProviderModel[] {
  if (!Array.isArray(body.models)) throw new ProviderDiscoveryError('Provider inventory is invalid.');
  return body.models.flatMap((value): DiscoveredProviderModel[] => {
    if (!isRecord(value) || typeof value.name !== 'string' || value.name.length === 0) return [];
    const upstreamModelId = value.name.replace(/^models\//, '');
    if (!upstreamModelId) return [];
    const contextWindow = optionalPositiveInteger(value.inputTokenLimit);
    return [{
      upstreamModelId,
      label: typeof value.displayName === 'string' ? value.displayName : upstreamModelId,
      capabilities: capabilitiesFor(provider, value),
      ...(contextWindow ? { contextWindow } : {}),
      rawSafeMetadata: {},
    }];
  });
}

function discoveryHeaders(provider: ProviderRecord, secret: string): Record<string, string> {
  const base = { accept: 'application/json' };
  if (provider.protocol === 'anthropic-messages') {
    return { ...base, 'x-api-key': secret, 'anthropic-version': '2023-06-01' };
  }
  if (provider.protocol === 'gemini-generate-content') {
    return { ...base, 'x-goog-api-key': secret };
  }
  return { ...base, authorization: `Bearer ${secret}` };
}

function discoveryUrl(provider: ProviderRecord): string {
  const defaultPath = provider.protocol === 'gemini-generate-content' ? '/models' : '/models';
  const configuredPath = (provider.discoveryConfig?.modelsPath ?? defaultPath).trim();
  const relativePath = configuredPath.replace(/^\/+/, '');
  if (
    !relativePath
    || relativePath.includes('\\')
    || relativePath.split('/').includes('..')
    || /^[a-z][a-z0-9+.-]*:/i.test(relativePath)
  ) throw new ProviderDiscoveryError('Provider discovery configuration is invalid.');
  const baseUrl = new URL(provider.baseUrl.endsWith('/') ? provider.baseUrl : `${provider.baseUrl}/`);
  const resolved = new URL(relativePath, baseUrl);
  if (resolved.origin !== baseUrl.origin || !resolved.pathname.startsWith(baseUrl.pathname)) {
    throw new ProviderDiscoveryError('Provider discovery configuration is invalid.');
  }
  return resolved.toString();
}

export async function discoverProviderModels(
  provider: ProviderRecord,
  secret: string,
  dependencies: ProviderDiscoveryDependencies = {},
): Promise<DiscoveredProviderModel[]> {
  if (provider.state !== 'active') throw new ProviderDiscoveryError();
  const request = dependencies.request ?? requestSafeHttps;
  let response: SafeTransportResponse;
  try {
    response = await request(discoveryUrl(provider), {
      method: 'GET',
      headers: discoveryHeaders(provider, secret),
      timeoutMs: 15_000,
      maxResponseBytes: 2 * 1024 * 1024,
      maxRedirects: 2,
      maxCrossOriginRedirects: 0,
    });
  } catch {
    throw new ProviderDiscoveryError();
  }
  if (response.status < 200 || response.status >= 300) throw new ProviderDiscoveryError();
  let parsed: unknown;
  try {
    parsed = JSON.parse(response.body.toString('utf8')) as unknown;
  } catch {
    throw new ProviderDiscoveryError('Provider inventory is invalid.');
  }
  if (!isRecord(parsed)) throw new ProviderDiscoveryError('Provider inventory is invalid.');
  const models = provider.protocol === 'gemini-generate-content'
    ? parseGemini(provider, parsed)
    : parseOpenAiLike(provider, parsed);
  const unique = new Map(models.map((model) => [model.upstreamModelId, model]));
  return [...unique.values()];
}
