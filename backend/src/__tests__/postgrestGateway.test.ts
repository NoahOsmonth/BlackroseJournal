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
});
