import type { OmnirouteAdapter, OmnirouteRequestError } from './omnirouteAdapter';

export interface PublishedModelRow {
  modelId: string;
  label: string;
}

/** Persistence for the `control.admin_published_models` allowlist. */
export interface OmniroutePublishedModelsStore {
  list(): Promise<PublishedModelRow[]>;
  upsert(rows: PublishedModelRow[]): Promise<void>;
  remove(modelIds: string[]): Promise<void>;
}

export type OmnirouteAuditFn = (event: {
  actorUserId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  afterMetadata?: Record<string, unknown>;
}) => Promise<void>;

export class OmnirouteAdminValidationError extends Error {
  readonly name = 'OmnirouteAdminValidationError';
}

export class OmnirouteConfirmationError extends Error {
  readonly name = 'OmnirouteConfirmationError';
}

export interface UpdatePublishedModelsInput {
  upserts: PublishedModelRow[];
  removes: string[];
}

/** Free models only: OmniRoute/OpenRouter free tier ids are suffixed `:free`. */
function assertFreeModel(modelId: string): void {
  if (!modelId.endsWith(':free')) {
    throw new OmnirouteAdminValidationError(
      `Model ${modelId} is not a free model; only free models may be published.`,
    );
  }
}

export function createOmnirouteAdminService(deps: {
  adapter: OmnirouteAdapter;
  store: OmniroutePublishedModelsStore;
  audit?: OmnirouteAuditFn;
}) {
  const { adapter, store, audit } = deps;

  const recordAudit = async (
    actorUserId: string,
    action: string,
    resourceId: string,
    afterMetadata: Record<string, unknown>,
  ): Promise<void> => {
    if (!audit) return;
    await audit({
      actorUserId,
      action,
      resourceType: 'omniroute',
      resourceId,
      afterMetadata,
    });
  };

  return {
    enabled(): boolean {
      return true;
    },

    async listProviders(): Promise<unknown[]> {
      const providers = await adapter.listProviders();
      return Array.isArray(providers) ? providers : [];
    },

    async testProvider(id: string): Promise<{ valid: boolean; latencyMs?: number }> {
      return adapter.testProvider(id);
    },

    /** Catalog of models available on OmniRoute — free models only. */
    async listModels(): Promise<unknown[]> {
      const combos = await adapter.listCombos();
      if (!Array.isArray(combos)) return [];
      return combos.filter((combo) => {
        if (typeof combo !== 'object' || combo === null) return false;
        const id = (combo as { id?: unknown }).id ?? (combo as { model?: unknown }).model;
        return typeof id === 'string' && id.endsWith(':free');
      });
    },

    async listPublishedModels(): Promise<PublishedModelRow[]> {
      return store.list();
    },

    /**
     * Mutates the published-model allowlist (free models only).
     * Provider removal is intentionally absent — disconnect-only CRUD.
     */
    async updatePublishedModels(
      actorUserId: string,
      input: UpdatePublishedModelsInput,
    ): Promise<PublishedModelRow[]> {
      const seen = new Set<string>();
      const upserts = input.upserts.map((row) => {
        const modelId = typeof row.modelId === 'string' ? row.modelId.trim() : '';
        const label = typeof row.label === 'string' ? row.label.trim() : '';
        if (!modelId || !label) {
          throw new OmnirouteAdminValidationError('Published models require an id and a label.');
        }
        assertFreeModel(modelId);
        if (seen.has(modelId)) {
          throw new OmnirouteAdminValidationError(`Duplicate model id: ${modelId}`);
        }
        seen.add(modelId);
        return { modelId, label };
      });
      const removes = input.removes.map((id) => {
        if (typeof id !== 'string' || id.trim().length === 0) {
          throw new OmnirouteAdminValidationError('Removals must be non-empty model ids.');
        }
        return id.trim();
      });
      if (upserts.length > 0) await store.upsert(upserts);
      if (removes.length > 0) await store.remove(removes);
      await recordAudit(actorUserId, 'omniroute.published_models.update', 'published-models', {
        upserts: upserts.map((row) => row.modelId),
        removes,
      });
      return store.list();
    },

    /**
     * Disconnect-only teardown: removes the provider's models from the
     * published allowlist. Hard delete is not offered; the caller must type
     * the provider name exactly as confirmation.
     */
    async disconnectProvider(
      actorUserId: string,
      providerName: string,
      confirmation: string,
    ): Promise<PublishedModelRow[]> {
      const name = providerName.trim();
      if (name.length === 0) {
        throw new OmnirouteAdminValidationError('A provider name is required.');
      }
      if (confirmation !== `DELETE PROVIDER ${name}`) {
        throw new OmnirouteConfirmationError(
          'Type the confirmation phrase exactly to disconnect this provider.',
        );
      }
      const prefix = `${name}/`;
      const published = await store.list();
      const removes = published
        .map((row) => row.modelId)
        .filter((id) => id === name || id.startsWith(prefix));
      if (removes.length > 0) await store.remove(removes);
      await recordAudit(actorUserId, 'omniroute.provider.disconnect', name, {
        removedModels: removes,
        hardDelete: false,
      });
      return store.list();
    },
  };
}

export type OmnirouteAdminService = ReturnType<typeof createOmnirouteAdminService>;

/** Narrow re-export so route layers can map upstream failures. */
export type { OmnirouteRequestError };

export function isFreeModelId(modelId: string): boolean {
  try {
    assertFreeModel(modelId);
    return true;
  } catch {
    return false;
  }
}
