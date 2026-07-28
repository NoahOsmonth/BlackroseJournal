import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const run = process.env.RUN_SUPABASE_LOCAL_TESTS === '1'
  ? describe
  : describe.skip;
const baseUrl = process.env.SUPABASE_LOCAL_URL ?? '';
const serviceKey = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ?? '';
const ownerA = '00000000-0000-4000-8000-00000000000a';
const writerLeaseId = '00000000-0000-4000-8000-000000000077';
const writerLeaseToken = 'local-test-writer-token';
const sourceCredentialFingerprint = 'sha256:local-source';

function requestHeaders(): Record<string, string> {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };
}

async function rpc<T>(name: string, body: object): Promise<T> {
  const response = await fetch(`${baseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: requestHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    await response.body?.cancel();
    assert.fail(`RPC ${name} failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function claimBody(workerId: string): object {
  return {
    p_deployment_id: 'blackrose-primary',
    p_writer_epoch: 1,
    p_writer_lease_id: writerLeaseId,
    p_writer_lease_token: writerLeaseToken,
    p_source_credential_fingerprint: sourceCredentialFingerprint,
    p_worker_id: workerId,
    p_limit: 1,
    p_lease_seconds: 60,
  };
}

run('local PostgREST concurrency', () => {
  it('returns disjoint leases to parallel workers', { timeout: 5_000 }, async () => {
    assert.notEqual(baseUrl, '');
    assert.notEqual(serviceKey, '');

    const directWrite = await fetch(`${baseUrl}/rest/v1/memory_jobs`, {
      method: 'POST',
      headers: requestHeaders(),
      body: JSON.stringify({
        owner_id: ownerA,
        job_type: 'capture_source',
        idempotency_key: 'forbidden-direct-write',
        source_version: 'v1',
      }),
    });
    assert.equal(directWrite.ok, false);
    assert.equal([401, 403].includes(directWrite.status), true);

    for (const idempotencyKey of ['parallel-a', 'parallel-b']) {
      await rpc('memory_enqueue_job', {
        p_deployment_id: 'blackrose-primary',
        p_writer_epoch: 1,
        p_writer_lease_id: writerLeaseId,
        p_writer_lease_token: writerLeaseToken,
        p_source_credential_fingerprint: sourceCredentialFingerprint,
        p_owner_id: ownerA,
        p_job_type: 'capture_source',
        p_idempotency_key: idempotencyKey,
        p_source_version: 'v1',
        p_payload_reference: {},
        p_priority: 0,
        p_max_attempts: 5,
      });
    }

    const [workerA, workerB] = await Promise.all([
      rpc<Array<{ id: number; lease_token: string }>>(
        'memory_claim_jobs',
        claimBody('parallel-worker-a'),
      ),
      rpc<Array<{ id: number; lease_token: string }>>(
        'memory_claim_jobs',
        claimBody('parallel-worker-b'),
      ),
    ]);

    assert.equal(workerA.length, 1);
    assert.equal(workerB.length, 1);
    assert.notEqual(workerA[0]?.id, workerB[0]?.id);
    assert.notEqual(workerA[0]?.lease_token, workerB[0]?.lease_token);
  });

  it('skips a locked higher-priority job without waiting', {
    timeout: 5_000,
  }, async () => {
    for (const [idempotencyKey, priority] of [
      ['skip-locked-high', 100],
      ['skip-locked-next', 90],
    ] as const) {
      await rpc('memory_enqueue_job', {
        p_deployment_id: 'blackrose-primary',
        p_writer_epoch: 1,
        p_writer_lease_id: writerLeaseId,
        p_writer_lease_token: writerLeaseToken,
        p_source_credential_fingerprint: sourceCredentialFingerprint,
        p_owner_id: ownerA,
        p_job_type: 'capture_source',
        p_idempotency_key: idempotencyKey,
        p_source_version: 'v1',
        p_payload_reference: {},
        p_priority: priority,
        p_max_attempts: 5,
      });
    }

    const heldLock = rpc<null>('memory_test_hold_job_lock', {
      p_idempotency_key: 'skip-locked-high',
      p_seconds: 2,
    });
    await delay(250);

    const startedAt = performance.now();
    const claimed = await rpc<Array<{
      idempotency_key: string;
      lease_token: string;
    }>>('memory_claim_jobs', claimBody('skip-locked-worker'));
    const elapsedMilliseconds = performance.now() - startedAt;

    assert.equal(claimed.length, 1);
    assert.equal(claimed[0]?.idempotency_key, 'skip-locked-next');
    assert.ok(
      elapsedMilliseconds < 1_000,
      `claim waited ${Math.round(elapsedMilliseconds)}ms`,
    );
    await heldLock;
  });
});
