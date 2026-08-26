import type { OmnirouteAdapter } from './omnirouteAdapter';
import { OmnirouteAdminValidationError } from './omnirouteAdminService';

export interface OmnirouteUserKeyView {
  userId: string;
  omnirouteKeyId: string;
  /** Masked key — full keys are unretrievable post-creation, never sent to the UI. */
  maskedKey: string;
  allowedModels: string[];
  revokedAt: string | null;
}

export interface OmnirouteUsageRow {
  keyName: string;
  requests: number;
  totalTokens: number;
}

export interface OmnirouteEmbeddingsSettings {
  /** Configured embedding model id; null when embeddings are disabled. */
  embeddingModel: string | null;
}

function maskKey(key: string): string {
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

/**
 * Task 7 admin surface for per-user keys, usage and embeddings settings.
 * Reuses the shared adapter server-side; the admin app is proxied through
 * these routes only. Full keys are never returned after creation.
 */
export function createOmnirouteKeysService(deps: {
  adapter: Pick<OmnirouteAdapter, 'listKeys' | 'revokeKey' | 'updateKey'>;
  getUserKeyRow: (userId: string) => Promise<{
    omnirouteKeyId: string;
    encryptedKey: string;
    allowedModels: string[];
    revokedAt: string | null;
  } | null>;
  decrypt: (cipher: string) => Promise<string>;
  getEmbeddingModel: () => string | null;
  setEmbeddingModel: (model: string | null) => Promise<void>;
}) {
  const { adapter, getUserKeyRow, decrypt, getEmbeddingModel, setEmbeddingModel } = deps;

  const requireFreeModels = (models: string[]): void => {
    for (const model of models) {
      if (!model.endsWith(':free')) {
        throw new OmnirouteAdminValidationError(
          `Model ${model} is not a free model.`,
        );
      }
    }
  };

  return {
    /** Masked view of a user's key. Never exposes the full secret. */
    async getUserKeyView(userId: string): Promise<OmnirouteUserKeyView | null> {
      const row = await getUserKeyRow(userId);
      if (!row || row.revokedAt !== null) return null;
      return {
        userId,
        omnirouteKeyId: row.omnirouteKeyId,
        maskedKey: maskKey(await decrypt(row.encryptedKey)),
        allowedModels: [...row.allowedModels],
        revokedAt: row.revokedAt,
      };
    },

    /**
     * PATCH-not-recreate: edits allowed models on the existing OmniRoute key.
     * Free models only.
     */
    async setAllowedModels(userId: string, allowedModels: string[]): Promise<void> {
      requireFreeModels(allowedModels);
      const row = await getUserKeyRow(userId);
      if (!row || row.revokedAt !== null) {
        throw new OmnirouteAdminValidationError(`No active key for user ${userId}.`);
      }
      await adapter.updateKey(row.omnirouteKeyId, { allowedModels });
    },

    /** Revokes on OmniRoute; re-issue goes through the normal ensureUserKey flow. */
    async revokeUserKey(userId: string): Promise<void> {
      const row = await getUserKeyRow(userId);
      if (!row || row.revokedAt !== null) {
        throw new OmnirouteAdminValidationError(`No active key for user ${userId}.`);
      }
      await adapter.revokeKey(row.omnirouteKeyId);
    },

    /** Per-key usage from OmniRoute analytics (call_logs keyed by api_key_name = brj-<userId>). */
    async listUsage(): Promise<OmnirouteUsageRow[]> {
      const keys = await adapter.listKeys();
      if (!Array.isArray(keys)) return [];
      return keys
        .map((value) => {
          const row = value as Record<string, unknown>;
          const name = typeof row['name'] === 'string' ? row['name'] : '';
          const usage = (row['usage'] ?? {}) as Record<string, unknown>;
          const requests = typeof usage['requests'] === 'number' ? usage['requests']
            : typeof row['requests'] === 'number' ? row['requests'] : 0;
          const totalTokens = typeof usage['totalTokens'] === 'number' ? usage['totalTokens']
            : typeof row['totalTokens'] === 'number' ? row['totalTokens'] : 0;
          return { keyName: name, requests, totalTokens };
        })
        .filter((row) => row.keyName.startsWith('brj-'));
    },

    async getEmbeddingsSettings(): Promise<OmnirouteEmbeddingsSettings> {
      return { embeddingModel: getEmbeddingModel() };
    },

    /** Enable/disable by setting or clearing the embedding model (free models only). */
    async setEmbeddingsSettings(modelId: string | null): Promise<OmnirouteEmbeddingsSettings> {
      const trimmed = modelId?.trim() || null;
      if (trimmed !== null && !trimmed.endsWith(':free')) {
        throw new OmnirouteAdminValidationError(
          `Model ${trimmed} is not a free model.`,
        );
      }
      await setEmbeddingModel(trimmed);
      return { embeddingModel: trimmed };
    },
  };
}

export type OmnirouteKeysService = ReturnType<typeof createOmnirouteKeysService>;
