import { credentialFingerprint } from '../hashing/sourceHash';

export interface PostgrestGateway {
  rpc<T>(
    name: string,
    body: Readonly<Record<string, unknown>>,
  ): Promise<T>;
  /** SHA-256 fingerprint of the selected credential, derived once at creation. */
  readonly credentialFingerprint?: string;
}

export type PostgrestGatewayErrorCode =
  | 'MEMORY_GATEWAY_RPC_FORBIDDEN'
  | 'MEMORY_GATEWAY_REQUEST_FAILED'
  | 'MEMORY_GATEWAY_UNAVAILABLE'
  | 'MEMORY_GATEWAY_RESPONSE_INVALID'
  | MemoryDatabaseErrorCode;

export type MemoryDatabaseErrorCode =
  | 'MEMORY_STALE_WRITER_EPOCH'
  | 'MEMORY_WRITES_DISABLED'
  | 'MEMORY_DEPLOYMENT_MISMATCH'
  | 'MEMORY_STALE_JOB_LEASE'
  | 'MEMORY_WRITER_LEASE_MISMATCH'
  | 'MEMORY_WRITER_LEASE_EXPIRED'
  | 'MEMORY_WRITER_LEASE_TOKEN_INVALID'
  | 'MEMORY_SOURCE_CREDENTIAL_MISMATCH'
  | 'MEMORY_SESSION_REVOKED'
  | 'MEMORY_AUTHORITY_UNAVAILABLE'
  | 'OWNER_NOT_TRUSTED'
  | 'OWNER_DISABLED'
  | 'MIRROR_ENROLLMENT_REQUIRED'
  | 'MIRROR_OWNER_MISSING'
  | 'MIRROR_MANIFEST_NOT_FOUND'
  | 'MIRROR_MANIFEST_LIMIT'
  | 'MIRROR_CHUNK_LIMIT'
  | 'MIRROR_CHUNK_BYTE_LIMIT'
  | 'MIRROR_CHUNK_INVALID'
  | 'MIRROR_CHUNK_CONTRACT_INVALID'
  | 'MIRROR_CHUNK_OUT_OF_ORDER'
  | 'MIRROR_CHUNK_HASH_MISMATCH'
  | 'MIRROR_MANIFEST_HASH_MISMATCH'
  | 'MIRROR_MANIFEST_COUNT_MISMATCH'
  | 'MIRROR_MANIFEST_CHUNKS_INCOMPLETE'
  | 'MIRROR_RATE_LIMIT_BUSY'
  | 'MIRROR_RATE_LIMIT_MINUTE'
  | 'MIRROR_RATE_LIMIT_DAY'
  | 'MIRROR_RECEIPT_LIMIT'
  | 'MIRROR_RETAINED_REVISION_LIMIT'
  | 'MIRROR_STAGING_CONVERSATION_LIMIT'
  | 'MIRROR_STAGING_MESSAGE_LIMIT'
  | 'MIRROR_COMPLETION_PERMIT_INVALID'
  | 'MIRROR_COMPLETION_PERMIT_LIMIT'
  | 'MIRROR_COMPLETION_PERMIT_TOO_LATE'
  | 'MIRROR_COMPLETION_PERMIT_CONSUMED'
  | 'MIRROR_REVISION_CONFLICT'
  | 'MIRROR_SEQUENCE_CONFLICT'
  | 'MIRROR_TOMBSTONE_DOMINATES'
  | 'MIRROR_REPEATED_CONVERSATION_CONFLICT'
  | 'MIRROR_GENERATION_STALE'
  | 'MIRROR_DATASET_MISMATCH'
  | 'MEMORY_IDEMPOTENCY_CONFLICT'
  | 'ACTIVE_IMPORT_EXISTS'
  | 'MIRROR_MANIFEST_NOT_ACTIVE'
  | 'MIRROR_MANIFEST_NOT_CANCELLABLE'
  | 'MIRROR_MANIFEST_NOT_PREPARED'
  | 'MIRROR_AUTHORITY_VERSION_STALE'
  | 'MIRROR_COMPLETION_MISMATCH';

export class PostgrestGatewayError extends Error {
  constructor(
    readonly code: PostgrestGatewayErrorCode,
    readonly status: number | null,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(code);
    this.name = 'PostgrestGatewayError';
  }
}

interface PostgrestGatewayConfig {
  postgrestBaseUrl: string;
  postgrestServerKey: string;
  postgrestKeyKind: 'secret' | 'legacy_service_role';
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const ALLOWED_RPCS = new Set([
  'memory_enqueue_job',
  'memory_claim_jobs',
  'memory_finish_job',
  'memory_begin_import',
  'memory_accept_import_chunk',
  'memory_record_deletion',
  'memory_get_bootstrap',
  'memory_get_owner_state',
  'memory_get_source_inventory',
  'memory_reserve_mirror_request_v1',
  'memory_enroll_mirror_v1',
  'memory_begin_source_import_v1',
  'memory_accept_source_chunk_v1',
  'memory_get_source_import_v1',
  'memory_cancel_source_import_v1',
  'memory_validate_source_import_v1',
  'memory_prepare_source_completion_v1',
  'memory_complete_source_import_v1',
  'memory_apply_source_tombstone_v1',
  'memory_get_source_parity_v1',
]);
const DATABASE_ERROR_CODES = new Set<MemoryDatabaseErrorCode>([
  'MEMORY_STALE_WRITER_EPOCH',
  'MEMORY_WRITES_DISABLED',
  'MEMORY_DEPLOYMENT_MISMATCH',
  'MEMORY_STALE_JOB_LEASE',
  'MEMORY_WRITER_LEASE_MISMATCH',
  'MEMORY_WRITER_LEASE_EXPIRED',
  'MEMORY_WRITER_LEASE_TOKEN_INVALID',
  'MEMORY_SOURCE_CREDENTIAL_MISMATCH',
  'MEMORY_SESSION_REVOKED',
  'MEMORY_AUTHORITY_UNAVAILABLE',
  'OWNER_NOT_TRUSTED',
  'OWNER_DISABLED',
  'MIRROR_ENROLLMENT_REQUIRED',
  'MIRROR_OWNER_MISSING',
  'MIRROR_MANIFEST_NOT_FOUND',
  'MIRROR_MANIFEST_LIMIT',
  'MIRROR_CHUNK_LIMIT',
  'MIRROR_CHUNK_BYTE_LIMIT',
  'MIRROR_CHUNK_INVALID',
  'MIRROR_CHUNK_CONTRACT_INVALID',
  'MIRROR_CHUNK_OUT_OF_ORDER',
  'MIRROR_CHUNK_HASH_MISMATCH',
  'MIRROR_MANIFEST_HASH_MISMATCH',
  'MIRROR_MANIFEST_COUNT_MISMATCH',
  'MIRROR_MANIFEST_CHUNKS_INCOMPLETE',
  'MIRROR_RATE_LIMIT_BUSY',
  'MIRROR_RATE_LIMIT_MINUTE',
  'MIRROR_RATE_LIMIT_DAY',
  'MIRROR_RECEIPT_LIMIT',
  'MIRROR_RETAINED_REVISION_LIMIT',
  'MIRROR_STAGING_CONVERSATION_LIMIT',
  'MIRROR_STAGING_MESSAGE_LIMIT',
  'MIRROR_COMPLETION_PERMIT_INVALID',
  'MIRROR_COMPLETION_PERMIT_LIMIT',
  'MIRROR_COMPLETION_PERMIT_TOO_LATE',
  'MIRROR_COMPLETION_PERMIT_CONSUMED',
  'MIRROR_REVISION_CONFLICT',
  'MIRROR_SEQUENCE_CONFLICT',
  'MIRROR_TOMBSTONE_DOMINATES',
  'MIRROR_REPEATED_CONVERSATION_CONFLICT',
  'MIRROR_GENERATION_STALE',
  'MIRROR_DATASET_MISMATCH',
  'MEMORY_IDEMPOTENCY_CONFLICT',
  'ACTIVE_IMPORT_EXISTS',
  'MIRROR_MANIFEST_NOT_ACTIVE',
  'MIRROR_MANIFEST_NOT_CANCELLABLE',
  'MIRROR_MANIFEST_NOT_PREPARED',
  'MIRROR_AUTHORITY_VERSION_STALE',
  'MIRROR_COMPLETION_MISMATCH',
]);

function buildHeaders(config: PostgrestGatewayConfig): Headers {
  const headers = new Headers({
    apikey: config.postgrestServerKey,
    'content-type': 'application/json',
  });
  if (config.postgrestKeyKind === 'legacy_service_role') {
    headers.set('authorization', `Bearer ${config.postgrestServerKey}`);
  }
  return headers;
}

const RETRY_AFTER = /^RETRY_AFTER_SECONDS=(\d+)$/;

function extractStableDatabaseError(
  body: unknown,
): { code: MemoryDatabaseErrorCode; retryAfterSeconds: number | null } | null {
  if (
    body
    && typeof body === 'object'
    && !Array.isArray(body)
    && 'message' in body
    && typeof body.message === 'string'
    && DATABASE_ERROR_CODES.has(body.message as MemoryDatabaseErrorCode)
  ) {
    let retryAfterSeconds: number | null = null;
    if (
      'detail' in body
      && typeof body.detail === 'string'
    ) {
      const match = RETRY_AFTER.exec(body.detail);
      if (match) {
        retryAfterSeconds = Number(match[1]);
      }
    }
    return {
      code: body.message as MemoryDatabaseErrorCode,
      retryAfterSeconds,
    };
  }
  return null;
}

export function createPostgrestGateway(
  config: PostgrestGatewayConfig,
): PostgrestGateway & { readonly credentialFingerprint: string } {
  const baseUrl = config.postgrestBaseUrl.replace(/\/+$/, '');
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? 3_000;
  const derivedFingerprint = credentialFingerprint(config.postgrestServerKey);

  return {
    credentialFingerprint: derivedFingerprint,
    async rpc<T>(
      name: string,
      body: Readonly<Record<string, unknown>>,
    ): Promise<T> {
      if (!ALLOWED_RPCS.has(name)) {
        throw new PostgrestGatewayError('MEMORY_GATEWAY_RPC_FORBIDDEN', null);
      }

      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}/rpc/${name}`, {
          method: 'POST',
          headers: buildHeaders(config),
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        throw new PostgrestGatewayError('MEMORY_GATEWAY_UNAVAILABLE', null);
      }

      let payload: unknown;
      let parsed = false;
      try {
        payload = await response.json();
        parsed = true;
      } catch {
        // Upstream bodies are deliberately discarded.
      }

      if (parsed) {
        const stableDatabaseError = extractStableDatabaseError(payload);
        if (stableDatabaseError) {
          // A known database error code is authoritative regardless of the
          // transport status; composite RPC rows never carry a `message` column.
          throw new PostgrestGatewayError(
            stableDatabaseError.code,
            response.status,
            stableDatabaseError.retryAfterSeconds,
          );
        }
      }

      if (!response.ok) {
        throw new PostgrestGatewayError(
          'MEMORY_GATEWAY_REQUEST_FAILED',
          response.status,
        );
      }

      if (!parsed) {
        throw new PostgrestGatewayError(
          'MEMORY_GATEWAY_RESPONSE_INVALID',
          response.status,
        );
      }

      return payload as T;
    },
  };
}
