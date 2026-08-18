import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPostgrestGateway,
  PostgrestGatewayError,
} from '../memory/gateway/postgrestGateway';

describe('PostgREST memory gateway', () => {
  it('uses a modern secret only as the API key', async () => {
    let headers = new Headers();
    let seenUrl = '';
    let seenBody = '';
    const gateway = createPostgrestGateway({
      postgrestBaseUrl: 'https://gateway.example.test/rest/v1/',
      postgrestServerKey: 'sb_secret_test',
      postgrestKeyKind: 'secret',
      timeoutMs: 100,
      fetchImpl: async (input, init) => {
        seenUrl = String(input);
        headers = new Headers(init?.headers);
        seenBody = String(init?.body);
        return new Response(JSON.stringify([{ deployment_id: 'primary' }]), {
          status: 200,
        });
      },
    });

    const result = await gateway.rpc('memory_get_bootstrap', {});

    assert.deepEqual(result, [{ deployment_id: 'primary' }]);
    assert.equal(headers.get('apikey'), 'sb_secret_test');
    assert.equal(headers.get('authorization'), null);
    assert.equal(headers.get('content-type'), 'application/json');
    assert.equal(seenUrl, 'https://gateway.example.test/rest/v1/rpc/memory_get_bootstrap');
    assert.deepEqual(JSON.parse(seenBody), {});
  });

  it('uses a legacy service-role JWT in both required headers', async () => {
    let headers = new Headers();
    const gateway = createPostgrestGateway({
      postgrestBaseUrl: 'https://gateway.example.test/rest/v1',
      postgrestServerKey: 'legacy.jwt.value',
      postgrestKeyKind: 'legacy_service_role',
      timeoutMs: 100,
      fetchImpl: async (_input, init) => {
        headers = new Headers(init?.headers);
        return new Response('{}', { status: 200 });
      },
    });

    await gateway.rpc('memory_get_owner_state', {
      p_owner_id: '00000000-0000-4000-8000-00000000000a',
    });

    assert.equal(headers.get('apikey'), 'legacy.jwt.value');
    assert.equal(headers.get('authorization'), 'Bearer legacy.jwt.value');
  });

  it('allowlists RPC names before making a request', async () => {
    let fetchCalls = 0;
    const gateway = createPostgrestGateway({
      postgrestBaseUrl: 'https://gateway.example.test/rest/v1',
      postgrestServerKey: 'sb_secret_test',
      postgrestKeyKind: 'secret',
      timeoutMs: 100,
      fetchImpl: async () => {
        fetchCalls += 1;
        return new Response('{}');
      },
    });

    for (const name of [
      'memory_assert_writer',
      'memory_get_bootstrap?select=*',
      '../memory_get_bootstrap',
      'unknown',
    ]) {
      await assert.rejects(
        gateway.rpc(name, {}),
        (error: unknown) => error instanceof PostgrestGatewayError
          && error.code === 'MEMORY_GATEWAY_RPC_FORBIDDEN'
          && error.status === null,
      );
    }
    assert.equal(fetchCalls, 0);
  });

  it('allowlists every Phase 1 mirror RPC', async () => {
    const allowed = [
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
    ];
    let fetchCalls = 0;
    const gateway = createPostgrestGateway({
      postgrestBaseUrl: 'https://gateway.example.test/rest/v1',
      postgrestServerKey: 'sb_secret_test',
      postgrestKeyKind: 'secret',
      timeoutMs: 100,
      fetchImpl: async () => {
        fetchCalls += 1;
        return new Response('{}');
      },
    });
    for (const name of allowed) {
      await gateway.rpc(name, {});
    }
    assert.equal(fetchCalls, allowed.length);
    await assert.rejects(
      gateway.rpc('memory_assert_mirror_owner_access', {}),
      (error: unknown) => error instanceof PostgrestGatewayError
        && error.code === 'MEMORY_GATEWAY_RPC_FORBIDDEN',
    );
  });

  it('derives the credential fingerprint from the selected key bytes', () => {
    const secretGateway = createPostgrestGateway({
      postgrestBaseUrl: 'https://gateway.example.test/rest/v1',
      postgrestServerKey: 'sb_secret_test',
      postgrestKeyKind: 'secret',
      timeoutMs: 100,
      fetchImpl: async () => new Response('{}'),
    });
    assert.equal(
      secretGateway.credentialFingerprint,
      'sha256:fc370d44888fccafa52a428e20f3b7d293688490f6f799d6b38566b27fe0ab40',
    );

    const legacyGateway = createPostgrestGateway({
      postgrestBaseUrl: 'https://gateway.example.test/rest/v1',
      postgrestServerKey: 'legacy.jwt.value',
      postgrestKeyKind: 'legacy_service_role',
      timeoutMs: 100,
      fetchImpl: async () => new Response('{}'),
    });
    assert.equal(
      legacyGateway.credentialFingerprint,
      'sha256:adf01b3164165917b2f1ee85a9bea9267b2b67b016e77612a5cd40763abf5385',
    );
    assert.notEqual(
      legacyGateway.credentialFingerprint,
      'sha256:claimed-but-not-derived',
    );
  });

  it('redacts upstream response bodies and network failures', async () => {
    const secretBody = 'database password and private upstream detail';
    const rejected = createPostgrestGateway({
      postgrestBaseUrl: 'https://gateway.example.test/rest/v1',
      postgrestServerKey: 'sb_secret_test',
      postgrestKeyKind: 'secret',
      timeoutMs: 100,
      fetchImpl: async () => new Response(secretBody, { status: 409 }),
    });
    await assert.rejects(
      rejected.rpc('memory_get_bootstrap', {}),
      (error: unknown) => error instanceof PostgrestGatewayError
        && error.code === 'MEMORY_GATEWAY_REQUEST_FAILED'
        && error.status === 409
        && !String(error).includes(secretBody),
    );

    const unavailable = createPostgrestGateway({
      postgrestBaseUrl: 'https://gateway.example.test/rest/v1',
      postgrestServerKey: 'sb_secret_test',
      postgrestKeyKind: 'secret',
      timeoutMs: 100,
      fetchImpl: async () => { throw new Error(secretBody); },
    });
    await assert.rejects(
      unavailable.rpc('memory_get_bootstrap', {}),
      (error: unknown) => error instanceof PostgrestGatewayError
        && error.code === 'MEMORY_GATEWAY_UNAVAILABLE'
        && error.status === null
        && !String(error).includes(secretBody),
    );
  });

  it('rejects invalid JSON without returning the upstream body', async () => {
    const gateway = createPostgrestGateway({
      postgrestBaseUrl: 'https://gateway.example.test/rest/v1',
      postgrestServerKey: 'sb_secret_test',
      postgrestKeyKind: 'secret',
      timeoutMs: 100,
      fetchImpl: async () => new Response('{private-broken-json', { status: 200 }),
    });

    await assert.rejects(
      gateway.rpc('memory_get_bootstrap', {}),
      (error: unknown) => error instanceof PostgrestGatewayError
        && error.code === 'MEMORY_GATEWAY_RESPONSE_INVALID'
        && error.status === 200
        && !String(error).includes('private-broken-json'),
    );
  });

  it('reduces allowlisted database messages to stable error codes', async () => {
    const gateway = createPostgrestGateway({
      postgrestBaseUrl: 'https://gateway.example.test/rest/v1',
      postgrestServerKey: 'sb_secret_test',
      postgrestKeyKind: 'secret',
      timeoutMs: 100,
      fetchImpl: async () => new Response(JSON.stringify({
        message: 'MEMORY_STALE_WRITER_EPOCH',
        detail: 'private database detail',
      }), { status: 409 }),
    });

    await assert.rejects(
      gateway.rpc('memory_claim_jobs', {}),
      (error: unknown) => error instanceof PostgrestGatewayError
        && error.code === 'MEMORY_STALE_WRITER_EPOCH'
        && error.status === 409
        && !String(error).includes('private database detail'),
    );
  });

  it('reduces the Phase 1 stable database codes without leaking bodies', async () => {
    for (const code of [
      'MEMORY_WRITES_DISABLED',
      'MEMORY_DEPLOYMENT_MISMATCH',
      'MEMORY_WRITER_LEASE_MISMATCH',
      'MEMORY_WRITER_LEASE_EXPIRED',
      'MEMORY_WRITER_LEASE_TOKEN_INVALID',
      'MEMORY_SOURCE_CREDENTIAL_MISMATCH',
      'MEMORY_SESSION_REVOKED',
      'OWNER_NOT_TRUSTED',
      'OWNER_DISABLED',
      'MIRROR_MANIFEST_NOT_FOUND',
      'MIRROR_CHUNK_HASH_MISMATCH',
      'MIRROR_GENERATION_STALE',
      'ACTIVE_IMPORT_EXISTS',
      'MEMORY_AUTHORITY_UNAVAILABLE',
    ]) {
      const gateway = createPostgrestGateway({
        postgrestBaseUrl: 'https://gateway.example.test/rest/v1',
        postgrestServerKey: 'sb_secret_test',
        postgrestKeyKind: 'secret',
        timeoutMs: 100,
        fetchImpl: async () => new Response(JSON.stringify({
          message: code,
          detail: 'private database detail',
        }), { status: 200 }),
      });
      await assert.rejects(
        gateway.rpc('memory_begin_source_import_v1', {}),
        (error: unknown) => error instanceof PostgrestGatewayError
          && error.code === code
          && !String(error).includes('private database detail'),
      );
    }
  });

  it('carries database-derived retry timing for rate limits only', async () => {
    const gateway = createPostgrestGateway({
      postgrestBaseUrl: 'https://gateway.example.test/rest/v1',
      postgrestServerKey: 'sb_secret_test',
      postgrestKeyKind: 'secret',
      timeoutMs: 100,
      fetchImpl: async () => new Response(JSON.stringify({
        message: 'MIRROR_RATE_LIMIT_MINUTE',
        detail: 'RETRY_AFTER_SECONDS=37',
      }), { status: 200 }),
    });
    await assert.rejects(
      gateway.rpc('memory_reserve_mirror_request_v1', {}),
      (error: unknown) => error instanceof PostgrestGatewayError
        && error.code === 'MIRROR_RATE_LIMIT_MINUTE'
        && error.retryAfterSeconds === 37,
    );

    const noDetail = createPostgrestGateway({
      postgrestBaseUrl: 'https://gateway.example.test/rest/v1',
      postgrestServerKey: 'sb_secret_test',
      postgrestKeyKind: 'secret',
      timeoutMs: 100,
      fetchImpl: async () => new Response(JSON.stringify({
        message: 'MIRROR_RATE_LIMIT_BUSY',
      }), { status: 200 }),
    });
    await assert.rejects(
      noDetail.rpc('memory_reserve_mirror_request_v1', {}),
      (error: unknown) => error instanceof PostgrestGatewayError
        && error.code === 'MIRROR_RATE_LIMIT_BUSY'
        && error.retryAfterSeconds === null,
    );
  });
});
