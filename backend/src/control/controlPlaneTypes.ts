import type {
  CatalogResponse,
  ModelCapabilities,
  PublicCatalogModel,
  UserAiPreference,
} from '../../../packages/ai-control-plane-contracts/src';
import type {
  AdminProvider,
  CreateProviderRequest,
  ProviderCredentialMetadata,
  ProviderModelInventoryItem,
  ProviderProtocol,
  ProviderState,
  PublishCatalogModelRequest,
  UpdateProviderRequest,
  UpdateRuntimeSettingsRequest,
} from '../../../packages/ai-control-plane-contracts/src/admin';
import type { EncryptedSecretEnvelopeV1 } from '../security/envelopeEncryption';

export type {
  AdminProvider,
  CatalogResponse,
  CreateProviderRequest,
  ModelCapabilities,
  ProviderModelInventoryItem,
  PublicCatalogModel,
  PublishCatalogModelRequest,
  UpdateProviderRequest,
  UpdateRuntimeSettingsRequest,
  UserAiPreference,
};

export interface ProviderRecord {
  id: string;
  name: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  state: ProviderState;
  revision: number;
  displayMetadata?: { label: string; description?: string };
  discoveryConfig?: { modelsPath: string };
  createdAt: string;
  updatedAt: string;
}

export interface StoredProviderCredential extends EncryptedSecretEnvelopeV1 {
  label?: string;
  lastFour?: string;
  updatedAt?: string;
}

export interface ProviderModelRecord extends Omit<ProviderModelInventoryItem, 'capabilities'> {
  providerId: string;
  capabilities: ModelCapabilities;
  rawSafeMetadata: Record<string, unknown>;
  state: 'active' | 'disabled' | 'archived';
  revision: number;
  discoveredAt: string;
  updatedAt: string;
}

export type DiscoveredProviderModel = Omit<
  ProviderModelRecord,
  'id' | 'providerId' | 'state' | 'revision' | 'discoveredAt' | 'updatedAt'
>;

export interface ModelRouteRecord {
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

export interface RuntimeSettingsRecord {
  activeFlashRouteId: string | null;
  maxInputBytes: number;
  maxOutputTokens: number;
  requestTimeoutMs: number;
  revision: number;
  updatedAt: string;
}

export interface AuditEventInput {
  actorUserId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  beforeMetadata?: Record<string, unknown>;
  afterMetadata?: Record<string, unknown>;
}

export interface AuditEventRecord extends Omit<AuditEventInput, 'actorUserId'> {
  id: number;
  actorUserId: string | null;
  createdAt: string;
}

export interface FlashRouteInput {
  expectedModelRevision: number;
  maxInputBytes: number;
  maxOutputTokens: number;
  requestTimeoutMs: number;
  priority?: number;
}

export function credentialMetadata(
  credential: StoredProviderCredential | null,
): ProviderCredentialMetadata | undefined {
  if (!credential?.updatedAt) return undefined;
  return {
    keyVersion: credential.keyVersion,
    updatedAt: credential.updatedAt,
    ...(credential.label ? { label: credential.label } : {}),
    ...(credential.lastFour ? { lastFour: credential.lastFour } : {}),
  };
}

export function toAdminProvider(
  provider: ProviderRecord,
  credential?: ProviderCredentialMetadata,
): AdminProvider {
  return {
    id: provider.id,
    name: provider.name,
    protocol: provider.protocol,
    baseUrl: provider.baseUrl,
    state: provider.state,
    revision: provider.revision,
    ...(provider.displayMetadata ? { displayMetadata: provider.displayMetadata } : {}),
    ...(provider.discoveryConfig ? { discoveryConfig: provider.discoveryConfig } : {}),
    ...(credential ? { credentialMetadata: credential } : {}),
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
  };
}
