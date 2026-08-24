import type {
  CatalogResponse,
  ModelCapabilities,
  PublicCatalogModel,
} from '../../../packages/ai-control-plane-contracts/src';
import type {
  AdminProvider,
  CreateProviderRequest,
  ProviderCredentialInput,
  ProviderModelInventoryItem,
  PublishCatalogModelRequest,
  UpdateProviderRequest,
  UpdateRuntimeSettingsRequest,
} from '../../../packages/ai-control-plane-contracts/src/admin';

export type {
  AdminProvider,
  CatalogResponse,
  CreateProviderRequest,
  ModelCapabilities,
  ProviderCredentialInput,
  ProviderModelInventoryItem,
  PublicCatalogModel,
  PublishCatalogModelRequest,
  UpdateProviderRequest,
  UpdateRuntimeSettingsRequest,
};

export interface ProviderModelRecord extends ProviderModelInventoryItem {
  providerId: string;
  rawSafeMetadata: Record<string, unknown>;
  state: 'active' | 'disabled' | 'archived';
  revision: number;
  discoveredAt: string;
  updatedAt: string;
}

export interface ProviderHealth {
  providerId: string;
  status: 'healthy' | 'unavailable';
  modelCount?: number;
  checkedAt: string;
}

export interface ModelRoute {
  id: string;
  providerModelId: string;
  catalogModelId?: string;
  purpose: 'chat' | 'flash';
  state: 'active' | 'disabled' | 'archived';
  priority: number;
  maxInputBytes: number;
  maxOutputTokens: number;
  requestTimeoutMs: number;
  revision: number;
}

export interface RuntimeSettings {
  activeFlashRouteId: string | null;
  maxInputBytes: number;
  maxOutputTokens: number;
  requestTimeoutMs: number;
  revision: number;
  updatedAt: string;
}

export interface AuditEvent {
  id: number;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId?: string;
  beforeMetadata?: Record<string, unknown>;
  afterMetadata?: Record<string, unknown>;
  createdAt: string;
}

export interface FlashRouteInput {
  expectedModelRevision: number;
  maxInputBytes: number;
  maxOutputTokens: number;
  requestTimeoutMs: number;
  priority?: number;
}
