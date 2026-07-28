import {
  DEPLOYMENT_MODES,
  isMemoryAuthorityState,
  parseMemoryFeatureFlags,
  type DeploymentMode,
  type MemoryFeatureFlags,
} from '../../../../shared/memory/contracts';
import type { PostgrestGateway } from '../gateway/postgrestGateway';

export interface BootstrapState {
  deploymentId: string;
  writerEpoch: number;
  mode: DeploymentMode;
  backendBaseUrl: string | null;
  databaseFingerprint: string;
  writerLeaseId: string | null;
  writerLeaseExpiresAt: string | null;
  writerLeaseIssuer: string | null;
  writerLeaseKeyId: string | null;
  sourceCredentialFingerprint: string | null;
}

export interface OwnerMemoryState {
  authorityState: 'LOCAL' | 'MIRROR' | 'SHADOW' | 'CLOUD';
  authorityVersion: number;
  featureFlags: MemoryFeatureFlags;
}

export interface SourceInventoryCounts {
  conversationCount: number;
  messageCount: number;
  oldestAuthoredAt: string | null;
  newestAuthoredAt: string | null;
}

export interface MemoryRepository {
  getBootstrap(): Promise<BootstrapState>;
  getOwnerState(ownerId: string): Promise<OwnerMemoryState | null>;
  getSourceInventory(ownerId: string): Promise<SourceInventoryCounts>;
}

export type MemoryRepositoryErrorCode = 'MEMORY_DATA_INVALID';

export class MemoryRepositoryError extends Error {
  constructor(readonly code: MemoryRepositoryErrorCode) {
    super(code);
    this.name = 'MemoryRepositoryError';
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BOOTSTRAP_KEYS = [
  'deployment_id',
  'writer_epoch',
  'mode',
  'backend_base_url',
  'database_fingerprint',
  'writer_lease_id',
  'writer_lease_expires_at',
  'writer_lease_issuer',
  'writer_lease_key_id',
  'source_credential_fingerprint',
];

function invalid(): never {
  throw new MemoryRepositoryError('MEMORY_DATA_INVALID');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function oneRow(value: unknown): Record<string, unknown> {
  if (!Array.isArray(value) || value.length !== 1 || !isRecord(value[0])) {
    return invalid();
  }
  return value[0];
}

function positiveSafeInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    return invalid();
  }
  return value;
}

function nonnegativeSafeInteger(value: unknown): number {
  const parsed = typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value)
    : value;
  if (
    typeof parsed !== 'number'
    || !Number.isSafeInteger(parsed)
    || parsed < 0
  ) {
    return invalid();
  }
  return parsed;
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    return invalid();
  }
  return value;
}

function nullableString(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  return requiredString(value);
}

function nullableUuid(value: unknown): string | null {
  const parsed = nullableString(value);
  if (parsed !== null && !UUID.test(parsed)) {
    return invalid();
  }
  return parsed;
}

function nullableTimestamp(value: unknown): string | null {
  const parsed = nullableString(value);
  if (parsed === null) {
    return null;
  }
  const milliseconds = Date.parse(parsed);
  if (!Number.isFinite(milliseconds)) {
    return invalid();
  }
  return new Date(milliseconds).toISOString();
}

function parseBootstrap(value: unknown): BootstrapState {
  const row = oneRow(value);
  if (
    Object.keys(row).length !== BOOTSTRAP_KEYS.length
    || !BOOTSTRAP_KEYS.every((key) => key in row)
  ) {
    return invalid();
  }
  const mode = row.mode;
  if (
    typeof mode !== 'string'
    || !(DEPLOYMENT_MODES as readonly string[]).includes(mode)
  ) {
    return invalid();
  }

  return {
    deploymentId: requiredString(row.deployment_id),
    writerEpoch: positiveSafeInteger(row.writer_epoch),
    mode: mode as DeploymentMode,
    backendBaseUrl: nullableString(row.backend_base_url),
    databaseFingerprint: requiredString(row.database_fingerprint),
    writerLeaseId: nullableUuid(row.writer_lease_id),
    writerLeaseExpiresAt: nullableTimestamp(row.writer_lease_expires_at),
    writerLeaseIssuer: nullableString(row.writer_lease_issuer),
    writerLeaseKeyId: nullableString(row.writer_lease_key_id),
    sourceCredentialFingerprint: nullableString(
      row.source_credential_fingerprint,
    ),
  };
}

function parseOwnerState(value: unknown): OwnerMemoryState | null {
  if (!Array.isArray(value)) {
    return invalid();
  }
  if (value.length === 0) {
    return null;
  }
  if (value.length !== 1 || !isRecord(value[0])) {
    return invalid();
  }
  const row = value[0];
  const featureFlags = parseMemoryFeatureFlags(row.feature_flags);
  if (!isMemoryAuthorityState(row.authority_state) || !featureFlags) {
    return invalid();
  }
  return {
    authorityState: row.authority_state,
    authorityVersion: positiveSafeInteger(row.authority_version),
    featureFlags,
  };
}

function parseInventory(value: unknown): SourceInventoryCounts {
  const row = oneRow(value);
  return {
    conversationCount: nonnegativeSafeInteger(row.conversation_count),
    messageCount: nonnegativeSafeInteger(row.message_count),
    oldestAuthoredAt: nullableTimestamp(row.oldest_authored_at),
    newestAuthoredAt: nullableTimestamp(row.newest_authored_at),
  };
}

export function createMemoryRepository(
  gateway: PostgrestGateway,
): MemoryRepository {
  return {
    async getBootstrap() {
      return parseBootstrap(await gateway.rpc('memory_get_bootstrap', {}));
    },
    async getOwnerState(ownerId: string) {
      return parseOwnerState(await gateway.rpc('memory_get_owner_state', {
        p_owner_id: ownerId,
      }));
    },
    async getSourceInventory(ownerId: string) {
      return parseInventory(await gateway.rpc('memory_get_source_inventory', {
        p_owner_id: ownerId,
      }));
    },
  };
}
