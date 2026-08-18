import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { DeploymentWriteRequest } from '../../../shared/memory/deploymentAuthority';
import type { MirrorChunk } from '../../../shared/memory/mirrorContracts';
import { validMirrorChunk } from './sourceHash.test';
import {
  PostgrestGatewayError,
  type PostgrestGateway,
} from '../memory/gateway/postgrestGateway';
import {
  createSourceMirrorRepository,
  SourceMirrorRepositoryError,
  type SourceMirrorRepository,
} from '../memory/repositories/sourceMirrorRepository';

const ownerId = '00000000-0000-4000-8000-00000000000a';
const sessionId = '00000000-0000-4000-8000-0000000000ee';
const datasetId = '00000000-0000-4000-8000-0000000000aa';
const permitId = '00000000-0000-4000-8000-0000000000bb';

const authority: DeploymentWriteRequest = {
  deploymentId: 'blackrose-primary',
  writerEpoch: 7,
  writerLeaseId: '00000000-0000-4000-8000-000000000077',
  writerLeaseToken: 'opaque-writer-lease-token',
  sourceCredentialFingerprint: 'sha256:source-a',
};

const fence = {
  p_deployment_id: 'blackrose-primary',
  p_writer_epoch: 7,
  p_writer_lease_id: '00000000-0000-4000-8000-000000000077',
  p_writer_lease_token: 'opaque-writer-lease-token',
  p_source_credential_fingerprint: 'sha256:source-a',
  p_owner_id: ownerId,
  p_session_id: sessionId,
};

const ownerStateRow = {
  owner_id: ownerId,
  authority_state: 'MIRROR',
  authority_version: 3,
  dataset_id: datasetId,
  feature_flags: {
    cloudSourceMirroring: true,
    cloudProjectionBuild: false,
    shadowRetrieval: false,
    cloudReadAuthority: false,
    cloudWriteAuthority: false,
  },
  source_set_version: 2,
  source_set_receipt: 'mirror-union:manifest-1:2:sha256:abc',
};

const manifestRow = {
  id: 'manifest-1',
  owner_id: ownerId,
  contract_version: 1,
  dataset_id: datasetId,
  import_generation: 5,
  declared_chunk_count: 1,
  source_count: 1,
  message_count: 1,
  source_hash: 'sha256:abc',
  status: 'receiving',
  completion_receipt: null,
  cancellation_receipt: null,
  latest_error_code: null,
  completed_at: null,
  created_at: '2026-08-01T10:00:00.000Z',
};

const chunkReceiptRow = {
  id: 1,
  owner_id: ownerId,
  manifest_id: 'manifest-1',
  chunk_index: 0,
  item_count: 1,
  conversation_count: 1,
  message_count: 1,
  chunk_hash: 'sha256:abc',
  payload_hash: 'sha256:abc',
  receipt: 'mirror-chunk:manifest-1:0:sha256:abc',
  status: 'accepted',
};

const permitRow = {
  id: permitId,
  owner_id: ownerId,
  manifest_id: 'manifest-1',
  import_generation: 5,
  expected_authority_version: 3,
  expires_at: '2026-08-01T10:00:08.000Z',
  consumed_at: null,
};

const deletionRow = {
  id: '00000000-0000-4000-8000-0000000000cc',
  owner_id: ownerId,
  source_kind: 'journal',
  source_id: 'entry-1',
  source_revision: 2,
  client_event_id: 'journal%3Aentry-1:msg-1',
  deleted_at: '2026-08-01T10:00:00.000Z',
  reason_code: 'user_deleted',
  verification_status: 'pending',
};

const parityRows = [{
  authority_state: 'MIRROR',
  authority_version: 3,
  source_set_version: 2,
  source_set_receipt: 'mirror-union:manifest-1:2:sha256:abc',
  conversation_count: 1,
  message_count: 1,
  source_set_hash: 'sha256:abc',
}];

interface RecordedCall {
  name: string;
  body: Readonly<Record<string, unknown>>;
}

function gatewayReturning(
  rows: Readonly<Record<string, unknown>>,
  fingerprint = 'sha256:source-a',
): PostgrestGateway & {
  credentialFingerprint: string;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  return {
    credentialFingerprint: fingerprint,
    calls,
    async rpc<T>(name: string, body: Readonly<Record<string, unknown>>) {
      calls.push({ name, body });
      return rows[name] as T;
    },
  };
}

function repositoryFor(
  gateway: PostgrestGateway & { credentialFingerprint: string },
): SourceMirrorRepository {
  return createSourceMirrorRepository(gateway);
}

const beginInput = {
  manifestId: 'manifest-1',
  datasetId,
  contractVersion: 1,
  importGeneration: 5,
  declaredChunkCount: 1,
  sourceCount: 1,
  messageCount: 1,
  sourceHash: 'sha256:abc',
};

describe('source mirror repository', () => {
  it('reserves rate budget before every mutation and forwards the derived session ID', async () => {
    const gateway = gatewayReturning({
      memory_reserve_mirror_request_v1: {
        owner_id: ownerId,
        minute_window_started_at: '2026-08-01T10:00:00.000Z',
        minute_request_count: 1,
        minute_request_timestamps: [],
        day_started_on: '2026-08-01',
        day_request_count: 1,
        updated_at: '2026-08-01T10:00:00.000Z',
      },
      memory_enroll_mirror_v1: ownerStateRow,
      memory_begin_source_import_v1: manifestRow,
      memory_accept_source_chunk_v1: chunkReceiptRow,
      memory_cancel_source_import_v1: manifestRow,
      memory_validate_source_import_v1: manifestRow,
      memory_prepare_source_completion_v1: permitRow,
      memory_complete_source_import_v1: manifestRow,
      memory_apply_source_tombstone_v1: deletionRow,
    });
    const repository = repositoryFor(gateway);

    const chunk = validMirrorChunk();
    await repository.enroll(authority, ownerId, sessionId, datasetId);
    await repository.beginImport(authority, ownerId, sessionId, beginInput);
    await repository.acceptChunk(
      authority,
      ownerId,
      sessionId,
      'manifest-1',
      0,
      chunk,
      'sha256:1b2bb8cb1678f6d0d5a573e930308f6282a9910ec23b2985bd4ca368ae4b7387',
    );
    await repository.cancelImport(authority, ownerId, sessionId, 'manifest-1');
    await repository.validateImport(authority, ownerId, sessionId, 'manifest-1');
    await repository.prepareCompletion(
      authority,
      ownerId,
      sessionId,
      'manifest-1',
      3,
    );
    await repository.completeImport(authority, ownerId, sessionId, {
      manifestId: 'manifest-1',
      permitId,
      expectedAuthorityVersion: 3,
      preparedHash: 'sha256:prepared',
      membershipHash: 'sha256:membership',
    });
    await repository.applyTombstone(authority, ownerId, sessionId, {
      sourceKind: 'journal',
      sourceId: 'entry-1',
      sourceRevision: 2,
      previousAcceptedRevision: 1,
      clientEventId: 'journal%3Aentry-1:msg-1',
      deletedAt: '2026-08-01T10:00:00.000Z',
      reasonCode: 'user_deleted',
    });

    const mutations = [
      'memory_enroll_mirror_v1',
      'memory_begin_source_import_v1',
      'memory_accept_source_chunk_v1',
      'memory_cancel_source_import_v1',
      'memory_validate_source_import_v1',
      'memory_prepare_source_completion_v1',
      'memory_complete_source_import_v1',
      'memory_apply_source_tombstone_v1',
    ];
    assert.equal(gateway.calls.length, mutations.length * 2);
    for (let index = 0; index < mutations.length; index += 1) {
      const reserve = gateway.calls[index * 2];
      const mutation = gateway.calls[index * 2 + 1];
      assert.equal(reserve.name, 'memory_reserve_mirror_request_v1');
      assert.deepEqual(reserve.body, fence);
      assert.equal(mutation.name, mutations[index]);
      // The session ID is forwarded to every mutation body.
      assert.equal(mutation.body.p_session_id, sessionId);
      assert.equal(mutation.body.p_owner_id, ownerId);
      // The derived fingerprint is forwarded on every mutation body.
      assert.equal(
        mutation.body.p_source_credential_fingerprint,
        'sha256:source-a',
      );
    }
  });

  it('never reserves for read-only state routes', async () => {
    const gateway = gatewayReturning({
      memory_get_source_import_v1: manifestRow,
      memory_get_source_parity_v1: parityRows,
    });
    const repository = repositoryFor(gateway);

    await repository.getImport(ownerId, sessionId, 'manifest-1');
    await repository.getParity(ownerId, sessionId);

    assert.deepEqual(
      gateway.calls.map((call) => call.name),
      ['memory_get_source_import_v1', 'memory_get_source_parity_v1'],
    );
    assert.equal(gateway.calls[0].body.p_session_id, sessionId);
    assert.equal(gateway.calls[1].body.p_session_id, sessionId);
  });

  it('fails closed when the authority fingerprint is not derived from the selected key', async () => {
    const gateway = gatewayReturning(
      { memory_enroll_mirror_v1: ownerStateRow },
      'sha256:derived-a',
    );
    const repository = repositoryFor(gateway);
    await assert.rejects(
      repository.enroll(
        { ...authority, sourceCredentialFingerprint: 'sha256:claimed-a' },
        ownerId,
        sessionId,
        datasetId,
      ),
      (error: unknown) => error instanceof SourceMirrorRepositoryError
        && error.code === 'WRITER_CREDENTIAL_MISMATCH',
    );
    assert.equal(gateway.calls.length, 0);
  });

  it('maps every writer fence failure to its stable suspended code', async () => {
    for (const [databaseCode, expected] of [
      ['MEMORY_STALE_WRITER_EPOCH', 'WRITER_STALE_EPOCH'],
      ['MEMORY_WRITER_LEASE_MISMATCH', 'WRITER_LEASE_MISMATCH'],
      ['MEMORY_WRITER_LEASE_EXPIRED', 'WRITER_LEASE_EXPIRED'],
      ['MEMORY_WRITER_LEASE_TOKEN_INVALID', 'WRITER_TOKEN_REJECTED'],
      ['MEMORY_SOURCE_CREDENTIAL_MISMATCH', 'WRITER_CREDENTIAL_MISMATCH'],
      ['MEMORY_WRITES_DISABLED', 'WRITER_MODE_NOT_ACTIVE'],
      ['MEMORY_DEPLOYMENT_MISMATCH', 'WRITER_MODE_NOT_ACTIVE'],
    ] as const) {
      const gateway: PostgrestGateway = {
        credentialFingerprint: 'sha256:source-a',
        async rpc<T>() {
          throw new PostgrestGatewayError(databaseCode, 200);
        },
      };
      const repository = repositoryFor(
        gateway as PostgrestGateway & { credentialFingerprint: string },
      );
      await assert.rejects(
        repository.beginImport(authority, ownerId, sessionId, beginInput),
        (error: unknown) => error instanceof SourceMirrorRepositoryError
          && error.code === expected,
      );
    }
  });

  it('maps rate limits to typed 429 with database-derived retry timing', async () => {
    for (const [databaseCode, expectedSeconds] of [
      ['MIRROR_RATE_LIMIT_MINUTE', 37],
      ['MIRROR_RATE_LIMIT_DAY', 45],
      ['MIRROR_RATE_LIMIT_BUSY', null],
    ] as const) {
      const gateway: PostgrestGateway = {
        credentialFingerprint: 'sha256:source-a',
        async rpc<T>() {
          throw new PostgrestGatewayError(databaseCode, 200, expectedSeconds);
        },
      };
      const repository = repositoryFor(
        gateway as PostgrestGateway & { credentialFingerprint: string },
      );
      await assert.rejects(
        repository.beginImport(authority, ownerId, sessionId, beginInput),
        (error: unknown) => error instanceof SourceMirrorRepositoryError
          && error.code === 'MIRROR_RATE_LIMITED'
          && error.retryAfterSeconds === expectedSeconds,
      );
    }
  });

  it('maps revoked sessions, untrusted owners, and quotas to stable blocked codes', async () => {
    for (const [databaseCode, expected] of [
      ['MEMORY_SESSION_REVOKED', 'MIRROR_UNAUTHORIZED'],
      ['OWNER_NOT_TRUSTED', 'MIRROR_FORBIDDEN'],
      ['OWNER_DISABLED', 'MIRROR_FORBIDDEN'],
      ['MIRROR_ENROLLMENT_REQUIRED', 'MIRROR_FORBIDDEN'],
      ['MIRROR_OWNER_MISSING', 'MIRROR_FORBIDDEN'],
      ['MIRROR_STAGING_CONVERSATION_LIMIT', 'MIRROR_FORBIDDEN'],
      ['MIRROR_STAGING_MESSAGE_LIMIT', 'MIRROR_FORBIDDEN'],
      ['MIRROR_RETAINED_REVISION_LIMIT', 'MIRROR_FORBIDDEN'],
      ['MIRROR_RECEIPT_LIMIT', 'MIRROR_FORBIDDEN'],
      ['MIRROR_COMPLETION_PERMIT_LIMIT', 'MIRROR_FORBIDDEN'],
      ['MIRROR_MANIFEST_NOT_FOUND', 'MIRROR_NOT_FOUND'],
      ['MIRROR_CHUNK_BYTE_LIMIT', 'MIRROR_PAYLOAD_TOO_LARGE'],
      ['MIRROR_CHUNK_CONTRACT_INVALID', 'MIRROR_BAD_REQUEST'],
      ['MIRROR_CHUNK_INVALID', 'MIRROR_BAD_REQUEST'],
      ['MIRROR_CHUNK_LIMIT', 'MIRROR_BAD_REQUEST'],
      ['MIRROR_MANIFEST_LIMIT', 'MIRROR_BAD_REQUEST'],
      ['MEMORY_IDEMPOTENCY_CONFLICT', 'MIRROR_CONFLICT'],
      ['ACTIVE_IMPORT_EXISTS', 'MIRROR_CONFLICT'],
      ['MIRROR_GENERATION_STALE', 'MIRROR_CONFLICT'],
      ['MIRROR_DATASET_MISMATCH', 'MIRROR_CONFLICT'],
      ['MIRROR_REVISION_CONFLICT', 'MIRROR_CONFLICT'],
      ['MIRROR_SEQUENCE_CONFLICT', 'MIRROR_CONFLICT'],
      ['MIRROR_CHUNK_OUT_OF_ORDER', 'MIRROR_CONFLICT'],
      ['MIRROR_TOMBSTONE_DOMINATES', 'MIRROR_CONFLICT'],
      ['MIRROR_REPEATED_CONVERSATION_CONFLICT', 'MIRROR_CONFLICT'],
      ['MIRROR_MANIFEST_NOT_ACTIVE', 'MIRROR_CONFLICT'],
      ['MIRROR_MANIFEST_NOT_CANCELLABLE', 'MIRROR_CONFLICT'],
      ['MIRROR_MANIFEST_NOT_PREPARED', 'MIRROR_CONFLICT'],
      ['MIRROR_AUTHORITY_VERSION_STALE', 'MIRROR_CONFLICT'],
      ['MIRROR_COMPLETION_PERMIT_CONSUMED', 'MIRROR_CONFLICT'],
      ['MIRROR_COMPLETION_PERMIT_TOO_LATE', 'MIRROR_CONFLICT'],
      ['MIRROR_CHUNK_HASH_MISMATCH', 'MIRROR_HASH_MISMATCH'],
      ['MIRROR_MANIFEST_HASH_MISMATCH', 'MIRROR_HASH_MISMATCH'],
      ['MIRROR_MANIFEST_COUNT_MISMATCH', 'MIRROR_HASH_MISMATCH'],
      ['MIRROR_MANIFEST_CHUNKS_INCOMPLETE', 'MIRROR_HASH_MISMATCH'],
      ['MIRROR_COMPLETION_MISMATCH', 'MIRROR_HASH_MISMATCH'],
      ['MIRROR_COMPLETION_PERMIT_INVALID', 'MIRROR_HASH_MISMATCH'],
      ['MEMORY_AUTHORITY_UNAVAILABLE', 'MIRROR_UNAVAILABLE'],
    ] as const) {
      const gateway: PostgrestGateway = {
        credentialFingerprint: 'sha256:source-a',
        async rpc<T>() {
          throw new PostgrestGatewayError(databaseCode, 200);
        },
      };
      const repository = repositoryFor(
        gateway as PostgrestGateway & { credentialFingerprint: string },
      );
      await assert.rejects(
        repository.beginImport(authority, ownerId, sessionId, beginInput),
        (error: unknown) => error instanceof SourceMirrorRepositoryError
          && error.code === expected,
      );
    }
  });

  it('maps only true dependency or transient failures to retryable unavailable', async () => {
    const gateway: PostgrestGateway = {
      credentialFingerprint: 'sha256:source-a',
      async rpc<T>() {
        throw new PostgrestGatewayError('MEMORY_GATEWAY_UNAVAILABLE', null);
      },
    };
    const repository = repositoryFor(
      gateway as PostgrestGateway & { credentialFingerprint: string },
    );
    await assert.rejects(
      repository.beginImport(authority, ownerId, sessionId, beginInput),
      (error: unknown) => error instanceof SourceMirrorRepositoryError
        && error.code === 'MIRROR_UNAVAILABLE',
    );

    const failedGateway: PostgrestGateway = {
      credentialFingerprint: 'sha256:source-a',
      async rpc<T>() {
        throw new PostgrestGatewayError('MEMORY_GATEWAY_REQUEST_FAILED', 500);
      },
    };
    const failed = repositoryFor(
      failedGateway as PostgrestGateway & { credentialFingerprint: string },
    );
    await assert.rejects(
      failed.getImport(ownerId, sessionId, 'manifest-1'),
      (error: unknown) => error instanceof SourceMirrorRepositoryError
        && error.code === 'MIRROR_UNAVAILABLE',
    );
  });

  it('fails closed on malformed repository rows without echoing them', async () => {
    for (const rows of [
      { memory_enroll_mirror_v1: 'garbage' },
      { memory_enroll_mirror_v1: [ownerStateRow] },
      { memory_enroll_mirror_v1: { ...ownerStateRow, authority_state: 'SUSPENDED' } },
      { memory_begin_source_import_v1: { id: 'manifest-1' } },
      { memory_get_source_import_v1: [] },
      { memory_get_source_parity_v1: [{}] },
      { memory_accept_source_chunk_v1: { chunk_index: 0 } },
      { memory_prepare_source_completion_v1: { id: permitId } },
      { memory_apply_source_tombstone_v1: { id: 'x' } },
    ] as const) {
      const gateway = gatewayReturning(rows);
      const repository = repositoryFor(gateway);
      await assert.rejects(
        (async () => {
          if ('memory_enroll_mirror_v1' in rows) {
            return repository.enroll(authority, ownerId, sessionId, datasetId);
          }
          if ('memory_begin_source_import_v1' in rows) {
            return repository.beginImport(
              authority,
              ownerId,
              sessionId,
              beginInput,
            );
          }
          if ('memory_get_source_import_v1' in rows) {
            return repository.getImport(ownerId, sessionId, 'manifest-1');
          }
          if ('memory_get_source_parity_v1' in rows) {
            return repository.getParity(ownerId, sessionId);
          }
          if ('memory_accept_source_chunk_v1' in rows) {
            return repository.acceptChunk(
              authority,
              ownerId,
              sessionId,
              'manifest-1',
              0,
              validMirrorChunk(),
              'sha256:abc',
            );
          }
          if ('memory_prepare_source_completion_v1' in rows) {
            return repository.prepareCompletion(
              authority,
              ownerId,
              sessionId,
              'manifest-1',
              3,
            );
          }
          return repository.applyTombstone(authority, ownerId, sessionId, {
            sourceKind: 'journal',
            sourceId: 'entry-1',
            sourceRevision: 2,
            previousAcceptedRevision: 1,
            clientEventId: 'journal%3Aentry-1:msg-1',
            deletedAt: '2026-08-01T10:00:00.000Z',
            reasonCode: 'user_deleted',
          });
        })(),
        (error: unknown) => error instanceof SourceMirrorRepositoryError
          && error.code === 'MIRROR_DATA_INVALID',
      );
    }
  });

  it('rejects malformed mutation input before any network call', async () => {
    const gateway = gatewayReturning({});
    const repository = repositoryFor(gateway);
    await assert.rejects(
      repository.beginImport(
        authority,
        'not-a-uuid',
        sessionId,
        beginInput,
      ),
      (error: unknown) => error instanceof SourceMirrorRepositoryError
        && error.code === 'MIRROR_BAD_REQUEST',
    );
    assert.equal(gateway.calls.length, 0);
  });

  it('returns the identical receipt for an identical route retry', async () => {
    const gateway = gatewayReturning({
      memory_reserve_mirror_request_v1: {
        owner_id: ownerId,
        minute_window_started_at: '2026-08-01T10:00:00.000Z',
        minute_request_count: 1,
        minute_request_timestamps: [],
        day_started_on: '2026-08-01',
        day_request_count: 1,
        updated_at: '2026-08-01T10:00:00.000Z',
      },
      memory_begin_source_import_v1: manifestRow,
    });
    const repository = repositoryFor(gateway);
    const first = await repository.beginImport(
      authority,
      ownerId,
      sessionId,
      beginInput,
    );
    const second = await repository.beginImport(
      authority,
      ownerId,
      sessionId,
      beginInput,
    );
    assert.deepEqual(first, second);
    assert.deepEqual(first, {
      id: 'manifest-1',
      ownerId,
      contractVersion: 1,
      datasetId,
      importGeneration: 5,
      declaredChunkCount: 1,
      sourceCount: 1,
      messageCount: 1,
      sourceHash: 'sha256:abc',
      status: 'receiving',
      completionReceipt: null,
      cancellationReceipt: null,
      latestErrorCode: null,
      completedAt: null,
      createdAt: '2026-08-01T10:00:00.000Z',
    });
  });
});
