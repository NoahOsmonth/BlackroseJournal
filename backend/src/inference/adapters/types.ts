import type {
  NormalizedInferenceEvent,
  NormalizedInferenceRequest,
  ProviderProtocol,
} from '../../../../packages/ai-control-plane-contracts/src';

export interface ProviderTarget {
  protocol: ProviderProtocol;
  baseUrl: string;
}

export interface ProviderInferenceLimits {
  timeoutMs?: number;
  maxResponseBytes?: number;
}

export interface ExecuteProviderInferenceInput {
  provider: ProviderTarget;
  modelId: string;
  secret: string;
  request: NormalizedInferenceRequest;
  signal?: AbortSignal;
  limits?: ProviderInferenceLimits;
  fetchFn?: typeof fetch;
}

export interface ProviderWireRequest {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

export interface ProviderAdapter {
  buildRequest(input: ExecuteProviderInferenceInput): ProviderWireRequest;
  parseNonStream(value: unknown): NormalizedInferenceEvent[];
  parseStream(response: Response): AsyncGenerator<NormalizedInferenceEvent>;
}
