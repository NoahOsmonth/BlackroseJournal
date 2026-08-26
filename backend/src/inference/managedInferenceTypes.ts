import type {
  InferencePurpose,
  NormalizedInferenceErrorCode,
  ModelCapabilities,
  ProviderProtocol,
} from '../../../packages/ai-control-plane-contracts/src';
import type { StoredProviderCredential } from '../control/controlPlaneTypes';

export interface ManagedInferenceRouteBinding {
  routeId: string;
  purpose: InferencePurpose;
  providerId: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  modelId: string;
  capabilities: ModelCapabilities;
  credential: StoredProviderCredential;
  maxInputBytes: number;
  maxOutputTokens: number;
  requestTimeoutMs: number;
}

export interface UsageEventInput {
  userId: string;
  routeId: string;
  status: 'succeeded' | 'failed' | 'cancelled';
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  errorCode?: NormalizedInferenceErrorCode;
}

export interface ManagedInferenceRepository {
  resolveRoute(
    userId: string,
    purpose: InferencePurpose,
  ): Promise<ManagedInferenceRouteBinding | null>;
  appendUsage(input: UsageEventInput): Promise<void>;
}
