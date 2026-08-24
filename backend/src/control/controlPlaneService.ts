import type {
  ArchiveCatalogModelRequest,
  ArchiveProviderRequest,
  RotateProviderCredentialRequest,
} from '../../../packages/ai-control-plane-contracts/src/admin';
import type { UpdateModelPreferenceRequest } from '../../../packages/ai-control-plane-contracts/src';
import { decryptSecret, encryptSecret, type MasterKeyProvider } from '../security/envelopeEncryption';
import { resolveSafeHttpsEndpoint } from '../security/safeEndpoint';
import { validateRequestCeilings } from './requestCeilings';
import {
  credentialMetadata,
  toAdminProvider,
  type AdminProvider,
  type AuditEventInput,
  type AuditEventRecord,
  type CatalogResponse,
  type CreateProviderRequest,
  type DiscoveredProviderModel,
  type FlashRouteInput,
  type ModelRouteRecord,
  type ProviderModelRecord,
  type ProviderRecord,
  type PublicCatalogModel,
  type PublishCatalogModelRequest,
  type RuntimeSettingsRecord,
  type StoredProviderCredential,
  type UpdateProviderRequest,
  type UpdateRuntimeSettingsRequest,
  type UserAiPreference,
} from './controlPlaneTypes';

export interface ControlPlaneRepository {
  listProviders(): Promise<readonly ProviderRecord[]>;
  getProvider(id: string): Promise<ProviderRecord | null>;
  createProvider(input: Omit<CreateProviderRequest, 'credential'>): Promise<ProviderRecord>;
  updateProvider(id: string, input: UpdateProviderRequest): Promise<ProviderRecord>;
  archiveProvider(id: string, expectedRevision: number): Promise<ProviderRecord>;
  getProviderCredential(providerId: string): Promise<StoredProviderCredential | null>;
  replaceProviderCredential(
    providerId: string,
    credential: StoredProviderCredential,
    expectedProviderRevision?: number,
  ): Promise<ProviderRecord | undefined>;
  listProviderModels(providerId: string): Promise<readonly ProviderModelRecord[]>;
  getProviderModel(id: string): Promise<ProviderModelRecord | null>;
  replaceDiscoveredModels(
    providerId: string,
    models: readonly DiscoveredProviderModel[],
    expectedProviderRevision: number,
  ): Promise<readonly ProviderModelRecord[]>;
  archiveProviderModel(id: string, expectedRevision: number): Promise<ProviderModelRecord>;
  getCatalog(): Promise<CatalogResponse>;
  publishCatalogModel(
    providerId: string,
    request: PublishCatalogModelRequest,
    expectedCatalogRevision: number,
  ): Promise<PublicCatalogModel>;
  archiveCatalogModel(id: string, expectedRevision: number): Promise<PublicCatalogModel>;
  getPreference(userId: string): Promise<UserAiPreference | null>;
  updatePreference(userId: string, input: UpdateModelPreferenceRequest): Promise<UserAiPreference>;
  getRuntimeSettings(): Promise<RuntimeSettingsRecord>;
  updateRuntimeSettings(input: UpdateRuntimeSettingsRequest): Promise<RuntimeSettingsRecord>;
  createFlashRoute(providerModelId: string, input: FlashRouteInput): Promise<ModelRouteRecord>;
  appendAudit(event: AuditEventInput): Promise<void>;
  listAuditEvents(limit: number): Promise<readonly AuditEventRecord[]>;
}

export type DiscoverProvider = (
  provider: ProviderRecord,
  secret: string,
) => Promise<readonly DiscoveredProviderModel[]>;

export class ControlPlaneConflictError<T extends { revision: number } = ProviderRecord> extends Error {
  readonly currentRevision: number;
  readonly currentState: T;

  constructor(currentState: T) {
    super('The resource changed before this mutation was applied.');
    this.name = 'ControlPlaneConflictError';
    this.currentRevision = currentState.revision;
    this.currentState = currentState;
  }
}

export class ControlPlaneRepositoryConflictError extends Error {
  constructor() {
    super('The repository rejected a stale revision.');
    this.name = 'ControlPlaneRepositoryConflictError';
  }
}

export class ControlPlaneNotFoundError extends Error {
  constructor(resource: string) {
    super(`${resource} was not found.`);
    this.name = 'ControlPlaneNotFoundError';
  }
}

export class ControlPlaneValidationError extends Error {
  constructor() {
    super('Control plane input is invalid.');
    this.name = 'ControlPlaneValidationError';
  }
}

export interface ControlPlaneServiceDependencies {
  repository: ControlPlaneRepository;
  masterKeys: MasterKeyProvider;
  discover: DiscoverProvider;
  decryptCredential?: typeof decryptSecret;
  validateEndpoint?: (url: string) => Promise<unknown>;
}

function safeProviderMetadata(provider: ProviderRecord): Record<string, unknown> {
  return {
    id: provider.id,
    name: provider.name,
    protocol: provider.protocol,
    baseUrl: provider.baseUrl,
    state: provider.state,
    revision: provider.revision,
  };
}

export function createControlPlaneService(deps: ControlPlaneServiceDependencies) {
  const decryptCredential = deps.decryptCredential ?? decryptSecret;
  const validateEndpoint = deps.validateEndpoint ?? resolveSafeHttpsEndpoint;
  const validateProviderEndpoint = async (url: string): Promise<void> => {
    try {
      await validateEndpoint(url);
    } catch {
      throw new ControlPlaneValidationError();
    }
  };
  const audit = (event: AuditEventInput) => deps.repository.appendAudit(event);
  const requireProvider = async (id: string): Promise<ProviderRecord> => {
    const provider = await deps.repository.getProvider(id);
    if (!provider) throw new ControlPlaneNotFoundError('Provider');
    return provider;
  };
  const requireProviderRevision = async (id: string, expected: number): Promise<ProviderRecord> => {
    const provider = await requireProvider(id);
    if (provider.revision !== expected) throw new ControlPlaneConflictError(provider);
    return provider;
  };
  const rethrowProviderConflict = async (error: unknown, id: string): Promise<never> => {
    if (error instanceof ControlPlaneRepositoryConflictError) {
      const current = await requireProvider(id);
      throw new ControlPlaneConflictError(current);
    }
    throw error;
  };

  return {
    async listProviders(): Promise<AdminProvider[]> {
      const providers = await deps.repository.listProviders();
      return Promise.all(providers.map(async (provider) => toAdminProvider(
        provider,
        credentialMetadata(await deps.repository.getProviderCredential(provider.id)),
      )));
    },

    async getProvider(id: string): Promise<AdminProvider | null> {
      const provider = await deps.repository.getProvider(id);
      if (!provider) return null;
      return toAdminProvider(
        provider,
        credentialMetadata(await deps.repository.getProviderCredential(id)),
      );
    },

    async getProviderHealth(id: string) {
      const provider = await requireProvider(id);
      const checkedAt = new Date().toISOString();
      try {
        const credential = await deps.repository.getProviderCredential(id);
        if (!credential) return { providerId: id, status: 'unavailable' as const, checkedAt };
        const secret = await decryptCredential(credential, deps.masterKeys, `provider:${id}`);
        const models = await deps.discover(provider, secret);
        return {
          providerId: id,
          status: 'healthy' as const,
          modelCount: models.length,
          checkedAt,
        };
      } catch {
        return { providerId: id, status: 'unavailable' as const, checkedAt };
      }
    },

    async createProvider(actorUserId: string, input: CreateProviderRequest): Promise<AdminProvider> {
      await validateProviderEndpoint(input.baseUrl);
      const { credential, ...providerInput } = input;
      const created = await deps.repository.createProvider(providerInput);
      const envelope = await encryptSecret(
        credential.secret,
        deps.masterKeys,
        `provider:${created.id}`,
      );
      const stored: StoredProviderCredential = {
        ...envelope,
        ...(credential.label ? { label: credential.label } : {}),
        lastFour: credential.secret.slice(-4),
        updatedAt: created.updatedAt,
      };
      await deps.repository.replaceProviderCredential(created.id, stored);
      await audit({
        actorUserId,
        action: 'provider.create',
        resourceType: 'provider',
        resourceId: created.id,
        afterMetadata: safeProviderMetadata(created),
      });
      return toAdminProvider(created, credentialMetadata(stored));
    },

    async updateProvider(
      actorUserId: string,
      id: string,
      input: UpdateProviderRequest,
    ): Promise<AdminProvider> {
      const before = await requireProviderRevision(id, input.expectedRevision);
      if (input.baseUrl !== undefined) await validateProviderEndpoint(input.baseUrl);
      const updated = await deps.repository.updateProvider(id, input)
        .catch((error) => rethrowProviderConflict(error, id));
      await audit({
        actorUserId,
        action: 'provider.update',
        resourceType: 'provider',
        resourceId: id,
        beforeMetadata: safeProviderMetadata(before),
        afterMetadata: safeProviderMetadata(updated),
      });
      return toAdminProvider(
        updated,
        credentialMetadata(await deps.repository.getProviderCredential(id)),
      );
    },

    async archiveProvider(
      actorUserId: string,
      id: string,
      input: ArchiveProviderRequest,
    ): Promise<AdminProvider> {
      const before = await requireProviderRevision(id, input.expectedRevision);
      const archived = await deps.repository.archiveProvider(id, input.expectedRevision)
        .catch((error) => rethrowProviderConflict(error, id));
      await audit({
        actorUserId,
        action: 'provider.archive',
        resourceType: 'provider',
        resourceId: id,
        beforeMetadata: safeProviderMetadata(before),
        afterMetadata: safeProviderMetadata(archived),
      });
      return toAdminProvider(archived);
    },

    async rotateCredential(
      actorUserId: string,
      id: string,
      input: RotateProviderCredentialRequest,
    ): Promise<AdminProvider> {
      const provider = await requireProviderRevision(id, input.expectedRevision);
      const envelope = await encryptSecret(
        input.credential.secret,
        deps.masterKeys,
        `provider:${provider.id}`,
      );
      const stored: StoredProviderCredential = {
        ...envelope,
        ...(input.credential.label ? { label: input.credential.label } : {}),
        lastFour: input.credential.secret.slice(-4),
        updatedAt: new Date().toISOString(),
      };
      const revisedProvider = await deps.repository.replaceProviderCredential(
        id,
        stored,
        input.expectedRevision,
      ).catch((error) => rethrowProviderConflict(error, id));
      await audit({
        actorUserId,
        action: 'provider.credential.replace',
        resourceType: 'provider',
        resourceId: id,
        afterMetadata: { keyVersion: stored.keyVersion, lastFour: stored.lastFour ?? null },
      });
      return toAdminProvider(revisedProvider ?? provider, credentialMetadata(stored));
    },

    async rekeyProviderCredential(
      actorUserId: string,
      id: string,
      expectedRevision: number,
    ): Promise<AdminProvider> {
      const provider = await requireProviderRevision(id, expectedRevision);
      const existing = await deps.repository.getProviderCredential(id);
      if (!existing) throw new ControlPlaneNotFoundError('Provider credential');
      const plaintext = await decryptCredential(existing, deps.masterKeys, `provider:${id}`);
      const envelope = await encryptSecret(plaintext, deps.masterKeys, `provider:${id}`);
      const stored: StoredProviderCredential = {
        ...envelope,
        ...(existing.label ? { label: existing.label } : {}),
        ...(existing.lastFour ? { lastFour: existing.lastFour } : {}),
        updatedAt: new Date().toISOString(),
      };
      const revisedProvider = await deps.repository.replaceProviderCredential(
        id,
        stored,
        expectedRevision,
      ).catch((error) => rethrowProviderConflict(error, id));
      await audit({
        actorUserId,
        action: 'provider.credential.rekey',
        resourceType: 'provider',
        resourceId: id,
        beforeMetadata: { keyVersion: existing.keyVersion },
        afterMetadata: { keyVersion: stored.keyVersion },
      });
      return toAdminProvider(revisedProvider ?? provider, credentialMetadata(stored));
    },

    async discoverProvider(actorUserId: string, id: string, expectedRevision: number) {
      const provider = await requireProviderRevision(id, expectedRevision);
      const credential = await deps.repository.getProviderCredential(id);
      if (!credential) throw new ControlPlaneNotFoundError('Provider credential');
      const secret = await decryptCredential(credential, deps.masterKeys, `provider:${id}`);
      const discovered = await deps.discover(provider, secret);
      const persisted = await deps.repository.replaceDiscoveredModels(
        id,
        discovered,
        expectedRevision,
      ).catch((error) => rethrowProviderConflict(error, id));
      await audit({
        actorUserId,
        action: 'provider.discover',
        resourceType: 'provider',
        resourceId: id,
        afterMetadata: { modelCount: persisted.length, providerRevision: provider.revision },
      });
      return {
        providerId: id,
        models: persisted.map(({ id: modelId, upstreamModelId, label, capabilities, contextWindow }) => ({
          id: modelId,
          upstreamModelId,
          label,
          capabilities,
          ...(contextWindow ? { contextWindow } : {}),
        })),
        discoveredAt: new Date().toISOString(),
      };
    },

    listProviderModels: (providerId: string) => deps.repository.listProviderModels(providerId),

    async archiveProviderModel(
      actorUserId: string,
      id: string,
      expectedRevision: number,
    ) {
      const archived = await deps.repository.archiveProviderModel(id, expectedRevision)
        .catch(async (error) => {
          if (error instanceof ControlPlaneRepositoryConflictError) {
            const current = await deps.repository.getProviderModel(id);
            if (!current) throw new ControlPlaneNotFoundError('Provider model');
            throw new ControlPlaneConflictError(current);
          }
          throw error;
        });
      await audit({
        actorUserId,
        action: 'provider_model.archive',
        resourceType: 'provider_model',
        resourceId: id,
        afterMetadata: { id: archived.id, revision: archived.revision, state: archived.state },
      });
      return archived;
    },

    getCatalog: () => deps.repository.getCatalog(),
    getPreference: (userId: string) => deps.repository.getPreference(userId),
    async updatePreference(userId: string, input: UpdateModelPreferenceRequest) {
      try {
        return await deps.repository.updatePreference(userId, input);
      } catch (error) {
        if (error instanceof ControlPlaneRepositoryConflictError) {
          const current = await deps.repository.getPreference(userId) ?? {
            selectedModelId: null,
            revision: 0,
            updatedAt: '',
          };
          throw new ControlPlaneConflictError(current);
        }
        throw error;
      }
    },

    async publishCatalogModel(
      actorUserId: string,
      providerId: string,
      input: PublishCatalogModelRequest,
      expectedCatalogRevision: number,
    ) {
      await requireProviderRevision(providerId, input.expectedRevision);
      const published = await deps.repository.publishCatalogModel(
        providerId,
        input,
        expectedCatalogRevision,
      ).catch(async (error) => {
        if (error instanceof ControlPlaneRepositoryConflictError) {
          const currentProvider = await requireProvider(providerId);
          if (currentProvider.revision !== input.expectedRevision) {
            throw new ControlPlaneConflictError(currentProvider);
          }
          throw new ControlPlaneConflictError(await deps.repository.getCatalog());
        }
        throw error;
      });
      await audit({
        actorUserId,
        action: 'catalog.publish',
        resourceType: 'catalog_model',
        resourceId: published.id,
        afterMetadata: { id: published.id, revision: published.revision },
      });
      return published;
    },

    async archiveCatalogModel(
      actorUserId: string,
      id: string,
      input: ArchiveCatalogModelRequest,
    ) {
      const archived = await deps.repository.archiveCatalogModel(id, input.expectedRevision)
        .catch(async (error) => {
          if (error instanceof ControlPlaneRepositoryConflictError) {
            const current = (await deps.repository.getCatalog()).models.find((item) => item.id === id);
            if (!current) throw new ControlPlaneNotFoundError('Catalog model');
            throw new ControlPlaneConflictError(current);
          }
          throw error;
        });
      await audit({
        actorUserId,
        action: 'catalog.archive',
        resourceType: 'catalog_model',
        resourceId: id,
        afterMetadata: { id: archived.id, revision: archived.revision },
      });
      return archived;
    },

    async createFlashRoute(actorUserId: string, providerModelId: string, input: FlashRouteInput) {
      validateRequestCeilings(input);
      const route = await deps.repository.createFlashRoute(providerModelId, input)
        .catch(async (error) => {
          if (error instanceof ControlPlaneRepositoryConflictError) {
            const current = await deps.repository.getProviderModel(providerModelId);
            if (!current) throw new ControlPlaneNotFoundError('Provider model');
            throw new ControlPlaneConflictError(current);
          }
          throw error;
        });
      await audit({
        actorUserId,
        action: 'route.flash.create',
        resourceType: 'model_route',
        resourceId: route.id,
        afterMetadata: { id: route.id, providerModelId, revision: route.revision },
      });
      return route;
    },

    getRuntimeSettings: () => deps.repository.getRuntimeSettings(),

    async updateRuntimeSettings(actorUserId: string, input: UpdateRuntimeSettingsRequest) {
      validateRequestCeilings(input);
      const before = await deps.repository.getRuntimeSettings();
      if (before.revision !== input.expectedRevision) {
        throw new ControlPlaneConflictError<RuntimeSettingsRecord>(before);
      }
      const updated = await deps.repository.updateRuntimeSettings(input)
        .catch(async (error) => {
          if (error instanceof ControlPlaneRepositoryConflictError) {
            throw new ControlPlaneConflictError<RuntimeSettingsRecord>(
              await deps.repository.getRuntimeSettings(),
            );
          }
          throw error;
        });
      await audit({
        actorUserId,
        action: 'runtime.update',
        resourceType: 'runtime_settings',
        beforeMetadata: { ...before },
        afterMetadata: { ...updated },
      });
      return updated;
    },

    listAuditEvents: (limit = 100) => deps.repository.listAuditEvents(limit),
  };
}

export type ControlPlaneService = ReturnType<typeof createControlPlaneService>;
