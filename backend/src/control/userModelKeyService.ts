import type { OmnirouteAdapter } from './omnirouteAdapter';

export interface UserModelKeyRow {
  userId: string;
  omnirouteKeyId: string;
  encryptedKey: string;
  allowedModels: string[];
  revokedAt: string | null;
}

export interface UserModelKeyRepository {
  getUserKey(userId: string): Promise<UserModelKeyRow | null>;
  putUserKey(row: UserModelKeyRow): Promise<void>;
  markRevoked(userId: string): Promise<void>;
}

export interface UserModelKeyServiceDeps {
  adapter: Pick<OmnirouteAdapter, 'createKey' | 'updateKey' | 'revokeKey'>;
  repository: UserModelKeyRepository;
  encrypt(secret: string): Promise<string>;
  decrypt(cipher: string): Promise<string>;
}

export interface UserModelKeyService {
  /** Returns the decrypted full key; creates a new key or reuses/PATCHes the existing one. */
  ensureUserKey(userId: string, allowedModels: string[]): Promise<string>;
  setAllowedModels(userId: string, allowedModels: string[]): Promise<void>;
  revokeUserKey(userId: string): Promise<void>;
}

export class UserKeyProvisioningError extends Error {
  constructor(message = 'Per-user model key provisioning failed.') {
    super(message);
    this.name = 'UserKeyProvisioningError';
  }
}

function normalizedSignature(models: string[]): string {
  return JSON.stringify([...new Set(models)].sort());
}

export function createUserModelKeyService(deps: UserModelKeyServiceDeps): UserModelKeyService {
  const { adapter, repository, encrypt, decrypt } = deps;

  const getActiveKey = async (userId: string): Promise<UserModelKeyRow | null> => {
    const row = await repository.getUserKey(userId);
    return row && row.revokedAt === null ? row : null;
  };

  return {
    async ensureUserKey(userId, allowedModels) {
      const signature = normalizedSignature(allowedModels);
      const active = await getActiveKey(userId);
      if (active) {
        if (normalizedSignature(active.allowedModels) === signature) {
          return decrypt(active.encryptedKey);
        }
        await adapter.updateKey(active.omnirouteKeyId, { allowedModels });
        const updated: UserModelKeyRow = { ...active, allowedModels };
        await repository.putUserKey(updated);
        return decrypt(updated.encryptedKey);
      }

      const created = await adapter.createKey({ name: `brj-${userId}`, allowedModels });
      const encryptedKey = await encrypt(created.key);
      await repository.putUserKey({
        userId,
        omnirouteKeyId: created.id,
        encryptedKey,
        allowedModels,
        revokedAt: null, // replaces any previously revoked row wholesale (same pk)
      });
      return created.key;
    },

    async setAllowedModels(userId, allowedModels) {
      const active = await getActiveKey(userId);
      if (!active) throw new UserKeyProvisioningError(`No active model key for user ${userId}.`);
      if (normalizedSignature(active.allowedModels) === normalizedSignature(allowedModels)) return;
      await adapter.updateKey(active.omnirouteKeyId, { allowedModels });
      await repository.putUserKey({ ...active, allowedModels });
    },

    async revokeUserKey(userId) {
      const active = await getActiveKey(userId);
      if (active) {
        await adapter.revokeKey(active.omnirouteKeyId);
      }
      await repository.markRevoked(userId);
    },
  };
}
