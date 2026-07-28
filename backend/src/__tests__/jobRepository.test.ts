import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { DeploymentWriteRequest } from '../../../shared/memory/deploymentAuthority';
import type { PostgrestGateway } from '../memory/gateway/postgrestGateway';
import { PostgrestGatewayError } from '../memory/gateway/postgrestGateway';
import {
  createJobRepository,
  JobRepositoryError,
} from '../memory/repositories/jobRepository';

const authority: DeploymentWriteRequest = {
  deploymentId: 'blackrose-primary',
  writerEpoch: 7,
  writerLeaseId: '00000000-0000-4000-8000-000000000077',
  writerLeaseToken: 'opaque-writer-lease-token',
  sourceCredentialFingerprint: 'sha256:source-a',
};

const jobRow = {
  id: 1,
  owner_id: '00000000-0000-4000-8000-00000000000a',
  job_type: 'capture_source',
  idempotency_key: 'source:entry-a:v1',
  source_version: 'v1',
  payload_reference: { sourceId: 'entry-a' },
  status: 'leased',
  priority: 0,
  attempt_count: 1,
  max_attempts: 5,
  available_at: '2026-07-28T00:00:00+00:00',
  lease_started_at: '2026-07-28T00:00:01+00:00',
  lease_expires_at: '2026-07-28T00:01:01+00:00',
  worker_id: 'web-1',
  lease_token: '00000000-0000-4000-8000-0000000000aa',
  last_error_code: null,
  created_at: '2026-07-28T00:00:00+00:00',
  updated_at: '2026-07-28T00:00:01+00:00',
  completed_at: null,
};

describe('durable job repository', () => {
  it('maps enqueue, claim, and finish only to exact transactional RPCs', async () => {
    const calls: Array<{
      name: string;
      body: Readonly<Record<string, unknown>>;
    }> = [];
    const gateway: PostgrestGateway = {
      async rpc<T>(
        name: string,
        body: Readonly<Record<string, unknown>>,
      ) {
        calls.push({ name, body });
        return (name === 'memory_claim_jobs' ? [jobRow] : jobRow) as T;
      },
    };
    const repository = createJobRepository(gateway);

    await repository.enqueue(authority, {
      ownerId: '00000000-0000-4000-8000-00000000000a',
      jobType: 'capture_source',
      idempotencyKey: 'source:entry-a:v1',
      sourceVersion: 'v1',
      payloadReference: { sourceId: 'entry-a' },
      priority: 0,
      maxAttempts: 5,
    });
    await repository.claim(authority, {
      workerId: 'web-1',
      limit: 10,
      leaseSeconds: 60,
    });
    await repository.finish(authority, {
      jobId: 1,
      workerId: 'web-1',
      leaseToken: '00000000-0000-4000-8000-0000000000aa',
      outcome: 'retryable',
      errorCode: 'PROVIDER_RATE_LIMIT',
      retryDelaySeconds: 30,
      provider: 'openrouter',
      model: 'model-id',
      tokenUsage: { inputTokens: 12, outputTokens: 4 },
      statusCode: 429,
      schemaVersion: 1,
      startedAt: '2026-07-28T00:00:00.000Z',
      redactedDiagnostics: { category: 'rate_limit' },
    });

    const fence = {
      p_deployment_id: 'blackrose-primary',
      p_writer_epoch: 7,
      p_writer_lease_id: '00000000-0000-4000-8000-000000000077',
      p_writer_lease_token: 'opaque-writer-lease-token',
      p_source_credential_fingerprint: 'sha256:source-a',
    };
    assert.deepEqual(calls, [
      {
        name: 'memory_enqueue_job',
        body: {
          ...fence,
          p_owner_id: '00000000-0000-4000-8000-00000000000a',
          p_job_type: 'capture_source',
          p_idempotency_key: 'source:entry-a:v1',
          p_source_version: 'v1',
          p_payload_reference: { sourceId: 'entry-a' },
          p_priority: 0,
          p_max_attempts: 5,
        },
      },
      {
        name: 'memory_claim_jobs',
        body: {
          ...fence,
          p_worker_id: 'web-1',
          p_limit: 10,
          p_lease_seconds: 60,
        },
      },
      {
        name: 'memory_finish_job',
        body: {
          ...fence,
          p_job_id: 1,
          p_worker_id: 'web-1',
          p_lease_token: '00000000-0000-4000-8000-0000000000aa',
          p_outcome: 'retryable',
          p_error_code: 'PROVIDER_RATE_LIMIT',
          p_retry_delay_seconds: 30,
          p_provider: 'openrouter',
          p_model: 'model-id',
          p_token_usage: { inputTokens: 12, outputTokens: 4 },
          p_status_code: 429,
          p_schema_version: 1,
          p_started_at: '2026-07-28T00:00:00.000Z',
          p_redacted_diagnostics: { category: 'rate_limit' },
        },
      },
    ]);
    assert.equal('request' in repository, false);
    assert.equal('table' in repository, false);
  });

  it('validates and normalizes returned job rows', async () => {
    const repository = createJobRepository({
      async rpc<T>() { return jobRow as T; },
    });
    const result = await repository.enqueue(authority, {
      ownerId: jobRow.owner_id,
      jobType: 'capture_source',
      idempotencyKey: 'key',
      sourceVersion: 'v1',
      payloadReference: {},
      priority: 0,
      maxAttempts: 5,
    });
    assert.equal(result.status, 'leased');
    assert.equal(result.availableAt, '2026-07-28T00:00:00.000Z');
    assert.equal(result.leaseToken, '00000000-0000-4000-8000-0000000000aa');
    assert.equal(result.attemptCount, 1);
  });

  it('rejects sensitive keys recursively before calling the gateway', async () => {
    let calls = 0;
    const repository = createJobRepository({
      async rpc<T>() { calls += 1; return jobRow as T; },
    });
    for (const payloadReference of [
      { content: 'private' },
      { nested: { journalText: 'private' } },
      { values: [{ secretKey: 'private' }] },
    ]) {
      await assert.rejects(
        repository.enqueue(authority, {
          ownerId: jobRow.owner_id,
          jobType: 'capture_source',
          idempotencyKey: 'key',
          sourceVersion: 'v1',
          payloadReference,
          priority: 0,
          maxAttempts: 5,
        }),
        (error: unknown) => error instanceof JobRepositoryError
          && error.code === 'MEMORY_JOB_INPUT_INVALID',
      );
    }
    await assert.rejects(
      repository.finish(authority, {
        jobId: 1,
        workerId: 'web-1',
        leaseToken: '00000000-0000-4000-8000-0000000000aa',
        outcome: 'succeeded',
        errorCode: null,
        retryDelaySeconds: 30,
        provider: null,
        model: null,
        tokenUsage: {},
        statusCode: 200,
        schemaVersion: 1,
        startedAt: '2026-07-28T00:00:00.000Z',
        redactedDiagnostics: { promptExcerpt: 'private' },
      }),
      (error: unknown) => error instanceof JobRepositoryError
        && error.code === 'MEMORY_JOB_INPUT_INVALID',
    );
    assert.equal(calls, 0);
  });

  it('maps only allowlisted database failures to stable errors', async () => {
    for (const code of [
      'MEMORY_STALE_WRITER_EPOCH',
      'MEMORY_WRITES_DISABLED',
      'MEMORY_STALE_JOB_LEASE',
      'MEMORY_WRITER_LEASE_MISMATCH',
      'MEMORY_WRITER_LEASE_EXPIRED',
      'MEMORY_WRITER_LEASE_TOKEN_INVALID',
      'MEMORY_SOURCE_CREDENTIAL_MISMATCH',
    ] as const) {
      const repository = createJobRepository({
        async rpc() { throw new PostgrestGatewayError(code, 409); },
      });
      await assert.rejects(
        repository.claim(authority, {
          workerId: 'web-1',
          limit: 1,
          leaseSeconds: 60,
        }),
        (error: unknown) => error instanceof JobRepositoryError
          && error.code === code
          && !String(error).includes(authority.writerLeaseToken),
      );
    }
  });

  it('fails closed on malformed rows and unknown upstream failures', async () => {
    const invalidRowRepository = createJobRepository({
      async rpc<T>() { return { ...jobRow, lease_token: 'bad' } as T; },
    });
    await assert.rejects(
      invalidRowRepository.enqueue(authority, {
        ownerId: jobRow.owner_id,
        jobType: 'capture_source',
        idempotencyKey: 'key',
        sourceVersion: 'v1',
        payloadReference: {},
        priority: 0,
        maxAttempts: 5,
      }),
      (error: unknown) => error instanceof JobRepositoryError
        && error.code === 'MEMORY_JOB_DATA_INVALID',
    );

    const unavailableRepository = createJobRepository({
      async rpc() {
        throw new PostgrestGatewayError('MEMORY_GATEWAY_REQUEST_FAILED', 500);
      },
    });
    await assert.rejects(
      unavailableRepository.claim(authority, {
        workerId: 'web-1',
        limit: 1,
        leaseSeconds: 60,
      }),
      (error: unknown) => error instanceof JobRepositoryError
        && error.code === 'MEMORY_JOB_UNAVAILABLE',
    );
  });
});
