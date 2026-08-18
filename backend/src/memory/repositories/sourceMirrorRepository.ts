import {
  isMemoryAuthorityState,
  parseMemoryFeatureFlags,
  type MemoryAuthorityState,
  type MemoryFeatureFlags,
} from '../../../../shared/memory/contracts';
import type { DeploymentWriteRequest } from '../../../../shared/memory/deploymentAuthority';
import type { MirrorChunk } from '../../../../shared/memory/mirrorContracts';
import {
  PostgrestGatewayError,
  type PostgrestGateway,
} from '../gateway/postgrestGateway';

export type MirrorManifestStatus =
  | 'created'
  | 'uploading'
  | 'receiving'
  | 'prepared'
  | 'verified'
  | 'failed'
  | 'cancelled';

export interface MirrorOwnerState {
  ownerId: string;
  authorityState: MemoryAuthorityState;
  authorityVersion: number;
  datasetId: string | null;
  featureFlags: MemoryFeatureFlags;
  sourceSetVersion: number;
  sourceSetReceipt: string | null;
}

export interface MirrorImportManifest {
  id: string;
  ownerId: string;
  contractVersion: number;
  datasetId: string | null;
  importGeneration: number;
  declaredChunkCount: number;
  sourceCount: number;
  messageCount: number;
  sourceHash: string | null;
  status: MirrorManifestStatus;
  completionReceipt: string | null;
  cancellationReceipt: string | null;
  latestErrorCode: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface MirrorChunkReceipt {
  chunkIndex: number;
  itemCount: number;
  conversationCount: number;
  messageCount: number;
  chunkHash: string;
  payloadHash: string;
  receipt: string | null;
  status: string;
}

export interface MirrorCompletionPermit {
  id: string;
  ownerId: string;
  manifestId: string;
  importGeneration: number;
  expectedAuthorityVersion: number;
  expiresAt: string;
  consumedAt: string | null;
}

export interface MirrorDeletionRecord {
  id: string;
  ownerId: string;
  sourceKind: string;
  sourceId: string;
  sourceRevision: number;
  clientEventId: string;
  deletedAt: string;
  reasonCode: string;
  verificationStatus: string;
}

export interface MirrorParityState {
  authorityState: MemoryAuthorityState;
  authorityVersion: number;
  sourceSetVersion: number;
  sourceSetReceipt: string | null;
  conversationCount: number;
  messageCount: number;
  sourceSetHash: string | null;
}

export interface BeginImportInput {
  manifestId: string;
  datasetId: string;
  contractVersion: number;
  importGeneration: number;
  declaredChunkCount: number;
  sourceCount: number;
  messageCount: number;
  sourceHash: string;
}

export interface CompleteImportInput {
  manifestId: string;
  permitId: string;
  expectedAuthorityVersion: number;
  preparedHash: string;
  membershipHash: string;
}

export interface TombstoneInput {
  sourceKind: string;
  sourceId: string;
  sourceRevision: number;
  previousAcceptedRevision: number | null;
  clientEventId: string;
  deletedAt: string;
  reasonCode: string;
}

export interface SourceMirrorRepository {
  enroll(
    authority: DeploymentWriteRequest,
    ownerId: string,
    sessionId: string,
    datasetId: string | null,
  ): Promise<MirrorOwnerState>;
  beginImport(
    authority: DeploymentWriteRequest,
    ownerId: string,
    sessionId: string,
    input: BeginImportInput,
  ): Promise<MirrorImportManifest>;
  getImport(
    ownerId: string,
    sessionId: string,
    manifestId: string,
  ): Promise<MirrorImportManifest>;
  acceptChunk(
    authority: DeploymentWriteRequest,
    ownerId: string,
    sessionId: string,
    manifestId: string,
    chunkIndex: number,
    chunk: MirrorChunk,
    chunkHash: string,
  ): Promise<MirrorChunkReceipt>;
  cancelImport(
    authority: DeploymentWriteRequest,
    ownerId: string,
    sessionId: string,
    manifestId: string,
  ): Promise<MirrorImportManifest>;
  validateImport(
    authority: DeploymentWriteRequest,
    ownerId: string,
    sessionId: string,
    manifestId: string,
  ): Promise<MirrorImportManifest>;
  prepareCompletion(
    authority: DeploymentWriteRequest,
    ownerId: string,
    sessionId: string,
    manifestId: string,
    expectedAuthorityVersion: number,
  ): Promise<MirrorCompletionPermit>;
  completeImport(
    authority: DeploymentWriteRequest,
    ownerId: string,
    sessionId: string,
    input: CompleteImportInput,
  ): Promise<MirrorImportManifest>;
  applyTombstone(
    authority: DeploymentWriteRequest,
    ownerId: string,
    sessionId: string,
    input: TombstoneInput,
  ): Promise<MirrorDeletionRecord>;
  getParity(
    ownerId: string,
    sessionId: string,
  ): Promise<MirrorParityState | null>;
}

export type SourceMirrorErrorCode =
  | 'MIRROR_DATA_INVALID'
  | 'MIRROR_BAD_REQUEST'
  | 'MIRROR_PAYLOAD_TOO_LARGE'
  | 'MIRROR_UNAUTHORIZED'
  | 'MIRROR_FORBIDDEN'
  | 'MIRROR_NOT_FOUND'
  | 'MIRROR_CONFLICT'
  | 'MIRROR_HASH_MISMATCH'
  | 'MIRROR_RATE_LIMITED'
  | 'MIRROR_WRITES_DISABLED'
  | 'WRITER_STALE_EPOCH'
  | 'WRITER_LEASE_MISMATCH'
  | 'WRITER_LEASE_EXPIRED'
  | 'WRITER_TOKEN_REJECTED'
  | 'WRITER_CREDENTIAL_MISMATCH'
  | 'WRITER_MODE_NOT_ACTIVE'
  | 'MIRROR_UNAVAILABLE';

export class SourceMirrorRepositoryError extends Error {
  constructor(
    readonly code: SourceMirrorErrorCode,
    readonly status: number | null,
    readonly retryAfterSeconds: number | null,
  ) {
    super(code);
    this.name = 'SourceMirrorRepositoryError';
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MANIFEST_STATUSES = new Set<MirrorManifestStatus>([
  'created',
  'uploading',
  'receiving',
  'prepared',
  'verified',
  'failed',
  'cancelled',
]);

/**
 * Stable mapping from database fence/quota codes to the client-facing codes.
 * Fence failures are suspended (stable 503), only genuine dependency or
 * transient failures map to MIRROR_UNAVAILABLE.
 */
const DATABASE_CODE_MAP: Partial<Record<string, SourceMirrorErrorCode>> = {
  MEMORY_WRITES_DISABLED: 'WRITER_MODE_NOT_ACTIVE',
  MEMORY_DEPLOYMENT_MISMATCH: 'WRITER_MODE_NOT_ACTIVE',
  MEMORY_STALE_WRITER_EPOCH: 'WRITER_STALE_EPOCH',
  MEMORY_WRITER_LEASE_MISMATCH: 'WRITER_LEASE_MISMATCH',
  MEMORY_WRITER_LEASE_EXPIRED: 'WRITER_LEASE_EXPIRED',
  MEMORY_WRITER_LEASE_TOKEN_INVALID: 'WRITER_TOKEN_REJECTED',
  MEMORY_SOURCE_CREDENTIAL_MISMATCH: 'WRITER_CREDENTIAL_MISMATCH',
  MEMORY_SESSION_REVOKED: 'MIRROR_UNAUTHORIZED',
  OWNER_NOT_TRUSTED: 'MIRROR_FORBIDDEN',
  OWNER_DISABLED: 'MIRROR_FORBIDDEN',
  MIRROR_ENROLLMENT_REQUIRED: 'MIRROR_FORBIDDEN',
  MIRROR_OWNER_MISSING: 'MIRROR_FORBIDDEN',
  MIRROR_STAGING_CONVERSATION_LIMIT: 'MIRROR_FORBIDDEN',
  MIRROR_STAGING_MESSAGE_LIMIT: 'MIRROR_FORBIDDEN',
  MIRROR_RETAINED_REVISION_LIMIT: 'MIRROR_FORBIDDEN',
  MIRROR_RECEIPT_LIMIT: 'MIRROR_FORBIDDEN',
  MIRROR_COMPLETION_PERMIT_LIMIT: 'MIRROR_FORBIDDEN',
  MIRROR_MANIFEST_NOT_FOUND: 'MIRROR_NOT_FOUND',
  MIRROR_CHUNK_BYTE_LIMIT: 'MIRROR_PAYLOAD_TOO_LARGE',
  MIRROR_CHUNK_CONTRACT_INVALID: 'MIRROR_BAD_REQUEST',
  MIRROR_CHUNK_INVALID: 'MIRROR_BAD_REQUEST',
  MIRROR_CHUNK_LIMIT: 'MIRROR_BAD_REQUEST',
  MIRROR_MANIFEST_LIMIT: 'MIRROR_BAD_REQUEST',
  MIRROR_CHUNK_HASH_MISMATCH: 'MIRROR_HASH_MISMATCH',
  MIRROR_MANIFEST_HASH_MISMATCH: 'MIRROR_HASH_MISMATCH',
  MIRROR_MANIFEST_COUNT_MISMATCH: 'MIRROR_HASH_MISMATCH',
  MIRROR_MANIFEST_CHUNKS_INCOMPLETE: 'MIRROR_HASH_MISMATCH',
  MIRROR_COMPLETION_MISMATCH: 'MIRROR_HASH_MISMATCH',
  MIRROR_COMPLETION_PERMIT_INVALID: 'MIRROR_HASH_MISMATCH',
  MIRROR_RATE_LIMIT_BUSY: 'MIRROR_RATE_LIMITED',
  MIRROR_RATE_LIMIT_MINUTE: 'MIRROR_RATE_LIMITED',
  MIRROR_RATE_LIMIT_DAY: 'MIRROR_RATE_LIMITED',
  MEMORY_IDEMPOTENCY_CONFLICT: 'MIRROR_CONFLICT',
  ACTIVE_IMPORT_EXISTS: 'MIRROR_CONFLICT',
  MIRROR_GENERATION_STALE: 'MIRROR_CONFLICT',
  MIRROR_DATASET_MISMATCH: 'MIRROR_CONFLICT',
  MIRROR_REVISION_CONFLICT: 'MIRROR_CONFLICT',
  MIRROR_SEQUENCE_CONFLICT: 'MIRROR_CONFLICT',
  MIRROR_CHUNK_OUT_OF_ORDER: 'MIRROR_CONFLICT',
  MIRROR_TOMBSTONE_DOMINATES: 'MIRROR_CONFLICT',
  MIRROR_REPEATED_CONVERSATION_CONFLICT: 'MIRROR_CONFLICT',
  MIRROR_MANIFEST_NOT_ACTIVE: 'MIRROR_CONFLICT',
  MIRROR_MANIFEST_NOT_CANCELLABLE: 'MIRROR_CONFLICT',
  MIRROR_MANIFEST_NOT_PREPARED: 'MIRROR_CONFLICT',
  MIRROR_AUTHORITY_VERSION_STALE: 'MIRROR_CONFLICT',
  MIRROR_COMPLETION_PERMIT_CONSUMED: 'MIRROR_CONFLICT',
  MIRROR_COMPLETION_PERMIT_TOO_LATE: 'MIRROR_CONFLICT',
};

function invalid(): never {
  throw new SourceMirrorRepositoryError('MIRROR_DATA_INVALID', null, null);
}

function inputInvalid(): never {
  throw new SourceMirrorRepositoryError('MIRROR_BAD_REQUEST', null, null);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function oneRow(value: unknown): Record<string, unknown> {
  // Composite-type RPCs (memory_enroll_mirror_v1, ..._source_import_v1) return
  // a single JSON object from PostgREST, never an array. An array here means a
  // mis-declared return shape and fails closed.
  if (!isRecord(value)) {
    return invalid();
  }
  return value;
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

function positiveSafeInteger(value: unknown): number {
  const parsed = typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value)
    : value;
  if (
    typeof parsed !== 'number'
    || !Number.isSafeInteger(parsed)
    || parsed < 1
  ) {
    return invalid();
  }
  return parsed;
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

function nullableUuid(value: unknown): string | null {
  const parsed = nullableString(value);
  if (parsed !== null && !UUID.test(parsed)) {
    return invalid();
  }
  return parsed;
}

function timestamp(value: unknown): string {
  const raw = requiredString(value);
  const milliseconds = Date.parse(raw);
  if (!Number.isFinite(milliseconds)) {
    return invalid();
  }
  return new Date(milliseconds).toISOString();
}

function nullableTimestamp(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  return timestamp(value);
}

function inputString(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    return inputInvalid();
  }
  return value;
}

function inputUuid(value: unknown): string {
  const parsed = inputString(value);
  if (!UUID.test(parsed)) {
    return inputInvalid();
  }
  return parsed;
}

function inputNullableUuid(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  return inputUuid(value);
}

function inputInteger(
  value: unknown,
  minimum: number,
  maximum: number,
): number {
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value < minimum
    || value > maximum
  ) {
    return inputInvalid();
  }
  return value;
}

function parseOwnerState(value: unknown): MirrorOwnerState {
  const row = oneRow(value);
  if (!isMemoryAuthorityState(row.authority_state)) {
    return invalid();
  }
  const featureFlags = parseMemoryFeatureFlags(row.feature_flags);
  if (!featureFlags) {
    return invalid();
  }
  return {
    ownerId: requiredString(row.owner_id),
    authorityState: row.authority_state,
    authorityVersion: positiveSafeInteger(row.authority_version),
    datasetId: nullableUuid(row.dataset_id),
    featureFlags,
    sourceSetVersion: nonnegativeSafeInteger(row.source_set_version),
    sourceSetReceipt: nullableString(row.source_set_receipt),
  };
}

function parseManifest(value: unknown): MirrorImportManifest {
  const row = oneRow(value);
  const status = row.status;
  if (
    typeof status !== 'string'
    || !MANIFEST_STATUSES.has(status as MirrorManifestStatus)
  ) {
    return invalid();
  }
  return {
    id: requiredString(row.id),
    ownerId: requiredString(row.owner_id),
    contractVersion: positiveSafeInteger(row.contract_version),
    datasetId: nullableUuid(row.dataset_id),
    importGeneration: nonnegativeSafeInteger(row.import_generation),
    declaredChunkCount: nonnegativeSafeInteger(row.declared_chunk_count),
    sourceCount: nonnegativeSafeInteger(row.source_count),
    messageCount: nonnegativeSafeInteger(row.message_count),
    sourceHash: nullableString(row.source_hash),
    status: status as MirrorManifestStatus,
    completionReceipt: nullableString(row.completion_receipt),
    cancellationReceipt: nullableString(row.cancellation_receipt),
    latestErrorCode: nullableString(row.latest_error_code),
    completedAt: nullableTimestamp(row.completed_at),
    createdAt: timestamp(row.created_at),
  };
}

function parseChunkReceipt(value: unknown): MirrorChunkReceipt {
  const row = oneRow(value);
  return {
    chunkIndex: nonnegativeSafeInteger(row.chunk_index),
    itemCount: nonnegativeSafeInteger(row.item_count),
    conversationCount: nonnegativeSafeInteger(row.conversation_count),
    messageCount: nonnegativeSafeInteger(row.message_count),
    chunkHash: requiredString(row.chunk_hash),
    payloadHash: requiredString(row.payload_hash),
    receipt: nullableString(row.receipt),
    status: requiredString(row.status),
  };
}

function parsePermit(value: unknown): MirrorCompletionPermit {
  const row = oneRow(value);
  return {
    id: requiredString(row.id),
    ownerId: requiredString(row.owner_id),
    manifestId: requiredString(row.manifest_id),
    importGeneration: nonnegativeSafeInteger(row.import_generation),
    expectedAuthorityVersion: positiveSafeInteger(
      row.expected_authority_version,
    ),
    expiresAt: timestamp(row.expires_at),
    consumedAt: nullableTimestamp(row.consumed_at),
  };
}

function parseDeletion(value: unknown): MirrorDeletionRecord {
  const row = oneRow(value);
  return {
    id: requiredString(row.id),
    ownerId: requiredString(row.owner_id),
    sourceKind: requiredString(row.source_kind),
    sourceId: requiredString(row.source_id),
    sourceRevision: positiveSafeInteger(row.source_revision),
    clientEventId: requiredString(row.client_event_id),
    deletedAt: timestamp(row.deleted_at),
    reasonCode: requiredString(row.reason_code),
    verificationStatus: requiredString(row.verification_status),
  };
}

function parseParity(value: unknown): MirrorParityState | null {
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
  if (!isMemoryAuthorityState(row.authority_state)) {
    return invalid();
  }
  return {
    authorityState: row.authority_state,
    authorityVersion: positiveSafeInteger(row.authority_version),
    sourceSetVersion: nonnegativeSafeInteger(row.source_set_version),
    sourceSetReceipt: nullableString(row.source_set_receipt),
    conversationCount: nonnegativeSafeInteger(row.conversation_count),
    messageCount: nonnegativeSafeInteger(row.message_count),
    sourceSetHash: nullableString(row.source_set_hash),
  };
}

function fence(
  authority: DeploymentWriteRequest,
  ownerId: string,
  sessionId: string,
): Record<string, unknown> {
  return {
    p_deployment_id: inputString(authority.deploymentId),
    p_writer_epoch: inputInteger(authority.writerEpoch, 1, Number.MAX_SAFE_INTEGER),
    p_writer_lease_id: inputUuid(authority.writerLeaseId),
    p_writer_lease_token: inputString(authority.writerLeaseToken),
    p_source_credential_fingerprint: inputString(
      authority.sourceCredentialFingerprint,
    ),
    p_owner_id: inputUuid(ownerId),
    p_session_id: inputUuid(sessionId),
  };
}

async function call<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof SourceMirrorRepositoryError) {
      throw error;
    }
    if (error instanceof PostgrestGatewayError) {
      const mapped = DATABASE_CODE_MAP[error.code];
      if (mapped) {
        throw new SourceMirrorRepositoryError(
          mapped,
          error.status,
          error.retryAfterSeconds ?? null,
        );
      }
      throw new SourceMirrorRepositoryError('MIRROR_UNAVAILABLE', error.status, null);
    }
    throw new SourceMirrorRepositoryError('MIRROR_UNAVAILABLE', null, null);
  }
}

export function createSourceMirrorRepository(
  gateway: PostgrestGateway & { readonly credentialFingerprint: string },
): SourceMirrorRepository {
  const derivedFingerprint = gateway.credentialFingerprint;

  /**
   * Central mutation wrapper: verifies the write-context fingerprint is the
   * one derived from the selected gateway credential (fail closed before any
   * network call), reserves rate budget from database time, then forwards the
   * full fence with the derived session id to the mutation RPC.
   */
  async function mutate(
    authority: DeploymentWriteRequest,
    ownerId: string,
    sessionId: string,
    rpcName: string,
    params: Readonly<Record<string, unknown>>,
  ): Promise<unknown> {
    if (authority.sourceCredentialFingerprint !== derivedFingerprint) {
      throw new SourceMirrorRepositoryError(
        'WRITER_CREDENTIAL_MISMATCH',
        null,
        null,
      );
    }
    const ownerFence = fence(authority, ownerId, sessionId);
    await call(() => (
      gateway.rpc('memory_reserve_mirror_request_v1', ownerFence)
    ));
    return call(() => gateway.rpc(rpcName, { ...ownerFence, ...params }));
  }

  async function read(
    rpcName: string,
    ownerId: string,
    sessionId: string,
    params: Readonly<Record<string, unknown>>,
  ): Promise<unknown> {
    return call(() => gateway.rpc(rpcName, {
      p_owner_id: inputUuid(ownerId),
      p_session_id: inputUuid(sessionId),
      ...params,
    }));
  }

  return {
    async enroll(authority, ownerId, sessionId, datasetId) {
      return parseOwnerState(await mutate(
        authority,
        ownerId,
        sessionId,
        'memory_enroll_mirror_v1',
        { p_dataset_id: inputNullableUuid(datasetId) },
      ));
    },

    async beginImport(authority, ownerId, sessionId, input) {
      return parseManifest(await mutate(
        authority,
        ownerId,
        sessionId,
        'memory_begin_source_import_v1',
        {
          p_manifest_id: inputString(input.manifestId),
          p_dataset_id: inputUuid(input.datasetId),
          p_contract_version: inputInteger(input.contractVersion, 1, 32),
          p_import_generation: inputInteger(
            input.importGeneration,
            1,
            Number.MAX_SAFE_INTEGER,
          ),
          p_declared_chunk_count: inputInteger(input.declaredChunkCount, 0, 160),
          p_source_count: inputInteger(input.sourceCount, 0, 2_560),
          p_message_count: inputInteger(input.messageCount, 0, 20_000),
          p_source_hash: inputString(input.sourceHash),
        },
      ));
    },

    async getImport(ownerId, sessionId, manifestId) {
      return parseManifest(await read(
        'memory_get_source_import_v1',
        ownerId,
        sessionId,
        { p_manifest_id: inputString(manifestId) },
      ));
    },

    async acceptChunk(
      authority,
      ownerId,
      sessionId,
      manifestId,
      chunkIndex,
      chunk,
      chunkHash,
    ) {
      return parseChunkReceipt(await mutate(
        authority,
        ownerId,
        sessionId,
        'memory_accept_source_chunk_v1',
        {
          p_manifest_id: inputString(manifestId),
          p_chunk_index: inputInteger(chunkIndex, 0, 159),
          p_chunk: chunk,
          p_chunk_hash: inputString(chunkHash),
        },
      ));
    },

    async cancelImport(authority, ownerId, sessionId, manifestId) {
      return parseManifest(await mutate(
        authority,
        ownerId,
        sessionId,
        'memory_cancel_source_import_v1',
        { p_manifest_id: inputString(manifestId) },
      ));
    },

    async validateImport(authority, ownerId, sessionId, manifestId) {
      return parseManifest(await mutate(
        authority,
        ownerId,
        sessionId,
        'memory_validate_source_import_v1',
        { p_manifest_id: inputString(manifestId) },
      ));
    },

    async prepareCompletion(
      authority,
      ownerId,
      sessionId,
      manifestId,
      expectedAuthorityVersion,
    ) {
      return parsePermit(await mutate(
        authority,
        ownerId,
        sessionId,
        'memory_prepare_source_completion_v1',
        {
          p_manifest_id: inputString(manifestId),
          p_expected_authority_version: inputInteger(
            expectedAuthorityVersion,
            1,
            Number.MAX_SAFE_INTEGER,
          ),
        },
      ));
    },

    async completeImport(authority, ownerId, sessionId, input) {
      return parseManifest(await mutate(
        authority,
        ownerId,
        sessionId,
        'memory_complete_source_import_v1',
        {
          p_manifest_id: inputString(input.manifestId),
          p_permit_id: inputUuid(input.permitId),
          p_expected_authority_version: inputInteger(
            input.expectedAuthorityVersion,
            1,
            Number.MAX_SAFE_INTEGER,
          ),
          p_prepared_hash: inputString(input.preparedHash),
          p_membership_hash: inputString(input.membershipHash),
        },
      ));
    },

    async applyTombstone(authority, ownerId, sessionId, input) {
      return parseDeletion(await mutate(
        authority,
        ownerId,
        sessionId,
        'memory_apply_source_tombstone_v1',
        {
          p_source_kind: inputString(input.sourceKind),
          p_source_id: inputString(input.sourceId),
          p_source_revision: inputInteger(
            input.sourceRevision,
            1,
            Number.MAX_SAFE_INTEGER,
          ),
          p_previous_accepted_revision: input.previousAcceptedRevision === null
            ? null
            : inputInteger(
              input.previousAcceptedRevision,
              1,
              Number.MAX_SAFE_INTEGER,
            ),
          p_client_event_id: inputString(input.clientEventId),
          p_deleted_at: inputString(input.deletedAt),
          p_reason_code: inputString(input.reasonCode),
        },
      ));
    },

    async getParity(ownerId, sessionId) {
      return parseParity(await read(
        'memory_get_source_parity_v1',
        ownerId,
        sessionId,
        {},
      ));
    },
  };
}
