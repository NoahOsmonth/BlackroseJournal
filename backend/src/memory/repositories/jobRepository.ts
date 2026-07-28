import {
  MEMORY_JOB_STATUSES,
  MEMORY_JOB_TYPES,
  type MemoryJobStatus,
  type MemoryJobType,
} from '../../../../shared/memory/contracts';
import type { DeploymentWriteRequest } from '../../../../shared/memory/deploymentAuthority';
import {
  PostgrestGatewayError,
  type MemoryDatabaseErrorCode,
  type PostgrestGateway,
} from '../gateway/postgrestGateway';

export interface MemoryJobRecord {
  id: number;
  ownerId: string;
  jobType: MemoryJobType;
  idempotencyKey: string;
  sourceVersion: string;
  payloadReference: Readonly<Record<string, unknown>>;
  status: MemoryJobStatus;
  priority: number;
  attemptCount: number;
  maxAttempts: number;
  availableAt: string;
  leaseStartedAt: string | null;
  leaseExpiresAt: string | null;
  workerId: string | null;
  leaseToken: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface EnqueueJobInput {
  ownerId: string;
  jobType: MemoryJobType;
  idempotencyKey: string;
  sourceVersion: string;
  payloadReference: Readonly<Record<string, unknown>>;
  priority: number;
  maxAttempts: number;
}

export interface ClaimJobsInput {
  workerId: string;
  limit: number;
  leaseSeconds: number;
}

export interface FinishJobInput {
  jobId: number;
  workerId: string;
  leaseToken: string;
  outcome: 'succeeded' | 'retryable' | 'dead_letter' | 'cancelled';
  errorCode: string | null;
  retryDelaySeconds: number;
  provider: string | null;
  model: string | null;
  tokenUsage: Readonly<Record<string, unknown>>;
  statusCode: number | null;
  schemaVersion: number;
  startedAt: string;
  redactedDiagnostics: Readonly<Record<string, unknown>>;
}

export interface JobRepository {
  enqueue(
    authority: DeploymentWriteRequest,
    input: EnqueueJobInput,
  ): Promise<MemoryJobRecord>;
  claim(
    authority: DeploymentWriteRequest,
    input: ClaimJobsInput,
  ): Promise<MemoryJobRecord[]>;
  finish(
    authority: DeploymentWriteRequest,
    input: FinishJobInput,
  ): Promise<MemoryJobRecord>;
}

export type JobRepositoryErrorCode =
  | 'MEMORY_JOB_INPUT_INVALID'
  | 'MEMORY_JOB_DATA_INVALID'
  | 'MEMORY_JOB_UNAVAILABLE'
  | MemoryDatabaseErrorCode;

export class JobRepositoryError extends Error {
  constructor(readonly code: JobRepositoryErrorCode) {
    super(code);
    this.name = 'JobRepositoryError';
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SENSITIVE_KEY = /content|prompt|journal|token|secret/i;
const DATABASE_ERRORS = new Set<MemoryDatabaseErrorCode>([
  'MEMORY_STALE_WRITER_EPOCH',
  'MEMORY_WRITES_DISABLED',
  'MEMORY_STALE_JOB_LEASE',
  'MEMORY_WRITER_LEASE_MISMATCH',
  'MEMORY_WRITER_LEASE_EXPIRED',
  'MEMORY_WRITER_LEASE_TOKEN_INVALID',
  'MEMORY_SOURCE_CREDENTIAL_MISMATCH',
]);

function inputInvalid(): never {
  throw new JobRepositoryError('MEMORY_JOB_INPUT_INVALID');
}

function dataInvalid(): never {
  throw new JobRepositoryError('MEMORY_JOB_DATA_INVALID');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSafeMetadata(
  value: unknown,
  seen: Set<unknown> = new Set(),
  forbidSensitiveKeys = true,
): boolean {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value))
  ) {
    return true;
  }
  if (typeof value !== 'object' || seen.has(value)) {
    return false;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.every((item) => (
      isSafeMetadata(item, seen, forbidSensitiveKeys)
    ));
  }
  return Object.entries(value).every(([key, item]) => (
    (!forbidSensitiveKeys || !SENSITIVE_KEY.test(key))
    && isSafeMetadata(item, seen, forbidSensitiveKeys)
  ));
}

function nonempty(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    return dataInvalid();
  }
  return value;
}

function nullableString(value: unknown): string | null {
  return value === null ? null : nonempty(value);
}

function integer(value: unknown, minimum: number, maximum: number): number {
  const normalized = typeof value === 'string' && /^-?\d+$/.test(value)
    ? Number(value)
    : value;
  if (
    typeof normalized !== 'number'
    || !Number.isSafeInteger(normalized)
    || normalized < minimum
    || normalized > maximum
  ) {
    return dataInvalid();
  }
  return normalized;
}

function timestamp(value: unknown, nullable = false): string | null {
  if (nullable && value === null) {
    return null;
  }
  const raw = nonempty(value);
  const milliseconds = Date.parse(raw);
  if (!Number.isFinite(milliseconds)) {
    return dataInvalid();
  }
  return new Date(milliseconds).toISOString();
}

function uuid(value: unknown, nullable = false): string | null {
  if (nullable && value === null) {
    return null;
  }
  const raw = nonempty(value);
  if (!UUID.test(raw)) {
    return dataInvalid();
  }
  return raw;
}

function singleJobRow(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    if (value.length !== 1 || !isRecord(value[0])) {
      return dataInvalid();
    }
    return value[0];
  }
  if (!isRecord(value)) {
    return dataInvalid();
  }
  return value;
}

function parseJob(value: unknown): MemoryJobRecord {
  const row = singleJobRow(value);
  if (
    !MEMORY_JOB_TYPES.includes(row.job_type as MemoryJobType)
    || !MEMORY_JOB_STATUSES.includes(row.status as MemoryJobStatus)
    || !isRecord(row.payload_reference)
    || !isSafeMetadata(row.payload_reference)
  ) {
    return dataInvalid();
  }
  return {
    id: integer(row.id, 1, Number.MAX_SAFE_INTEGER),
    ownerId: uuid(row.owner_id) as string,
    jobType: row.job_type as MemoryJobType,
    idempotencyKey: nonempty(row.idempotency_key),
    sourceVersion: nonempty(row.source_version),
    payloadReference: row.payload_reference,
    status: row.status as MemoryJobStatus,
    priority: integer(row.priority, -32_768, 32_767),
    attemptCount: integer(row.attempt_count, 0, Number.MAX_SAFE_INTEGER),
    maxAttempts: integer(row.max_attempts, 1, Number.MAX_SAFE_INTEGER),
    availableAt: timestamp(row.available_at) as string,
    leaseStartedAt: timestamp(row.lease_started_at, true),
    leaseExpiresAt: timestamp(row.lease_expires_at, true),
    workerId: nullableString(row.worker_id),
    leaseToken: uuid(row.lease_token, true),
    lastErrorCode: nullableString(row.last_error_code),
    createdAt: timestamp(row.created_at) as string,
    updatedAt: timestamp(row.updated_at) as string,
    completedAt: timestamp(row.completed_at, true),
  };
}

function positiveInputInteger(
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

function fence(authority: DeploymentWriteRequest): Record<string, unknown> {
  return {
    p_deployment_id: inputString(authority.deploymentId),
    p_writer_epoch: positiveInputInteger(
      authority.writerEpoch,
      1,
      Number.MAX_SAFE_INTEGER,
    ),
    p_writer_lease_id: inputUuid(authority.writerLeaseId),
    p_writer_lease_token: inputString(authority.writerLeaseToken),
    p_source_credential_fingerprint: inputString(
      authority.sourceCredentialFingerprint,
    ),
  };
}

function validateMetadata(
  value: unknown,
  forbidSensitiveKeys = true,
): Readonly<Record<string, unknown>> {
  if (!isRecord(value) || !isSafeMetadata(value, new Set(), forbidSensitiveKeys)) {
    return inputInvalid();
  }
  return value;
}

async function call<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (
      error instanceof JobRepositoryError
      && (
        error.code === 'MEMORY_JOB_INPUT_INVALID'
        || error.code === 'MEMORY_JOB_DATA_INVALID'
      )
    ) {
      throw error;
    }
    if (
      error instanceof PostgrestGatewayError
      && DATABASE_ERRORS.has(error.code as MemoryDatabaseErrorCode)
    ) {
      throw new JobRepositoryError(error.code as MemoryDatabaseErrorCode);
    }
    throw new JobRepositoryError('MEMORY_JOB_UNAVAILABLE');
  }
}

export function createJobRepository(
  gateway: PostgrestGateway,
): JobRepository {
  return {
    async enqueue(authority, input) {
      const body = {
        ...fence(authority),
        p_owner_id: inputUuid(input.ownerId),
        p_job_type: MEMORY_JOB_TYPES.includes(input.jobType)
          ? input.jobType
          : inputInvalid(),
        p_idempotency_key: inputString(input.idempotencyKey),
        p_source_version: inputString(input.sourceVersion),
        p_payload_reference: validateMetadata(input.payloadReference),
        p_priority: positiveInputInteger(input.priority, -32_768, 32_767),
        p_max_attempts: positiveInputInteger(
          input.maxAttempts,
          1,
          Number.MAX_SAFE_INTEGER,
        ),
      };
      return call(async () => parseJob(
        await gateway.rpc('memory_enqueue_job', body),
      ));
    },

    async claim(authority, input) {
      const body = {
        ...fence(authority),
        p_worker_id: inputString(input.workerId),
        p_limit: positiveInputInteger(input.limit, 1, 100),
        p_lease_seconds: positiveInputInteger(input.leaseSeconds, 15, 900),
      };
      return call(async () => {
        const value = await gateway.rpc<unknown>('memory_claim_jobs', body);
        if (!Array.isArray(value)) {
          return dataInvalid();
        }
        return value.map(parseJob);
      });
    },

    async finish(authority, input) {
      const statusCode = input.statusCode === null
        ? null
        : positiveInputInteger(input.statusCode, 100, 599);
      if (
        !['succeeded', 'retryable', 'dead_letter', 'cancelled']
          .includes(input.outcome)
        || !Number.isFinite(Date.parse(input.startedAt))
      ) {
        return inputInvalid();
      }
      const body = {
        ...fence(authority),
        p_job_id: positiveInputInteger(input.jobId, 1, Number.MAX_SAFE_INTEGER),
        p_worker_id: inputString(input.workerId),
        p_lease_token: inputUuid(input.leaseToken),
        p_outcome: input.outcome,
        p_error_code: input.errorCode === null
          ? null
          : inputString(input.errorCode),
        p_retry_delay_seconds: positiveInputInteger(
          input.retryDelaySeconds,
          15,
          3_600,
        ),
        p_provider: input.provider === null ? null : inputString(input.provider),
        p_model: input.model === null ? null : inputString(input.model),
        p_token_usage: validateMetadata(input.tokenUsage, false),
        p_status_code: statusCode,
        p_schema_version: positiveInputInteger(
          input.schemaVersion,
          1,
          Number.MAX_SAFE_INTEGER,
        ),
        p_started_at: input.startedAt,
        p_redacted_diagnostics: validateMetadata(input.redactedDiagnostics),
      };
      return call(async () => parseJob(
        await gateway.rpc('memory_finish_job', body),
      ));
    },
  };
}
