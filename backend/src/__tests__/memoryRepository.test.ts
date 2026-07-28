import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { PostgrestGateway } from '../memory/gateway/postgrestGateway';
import {
  createMemoryRepository,
  MemoryRepositoryError,
} from '../memory/repositories/memoryRepository';

const ownerId = '00000000-0000-4000-8000-00000000000a';
const featureFlags = {
  cloudSourceMirroring: true,
  cloudProjectionBuild: true,
  shadowRetrieval: true,
  cloudReadAuthority: false,
  cloudWriteAuthority: false,
};

function gatewayWith(
  values: Readonly<Record<string, unknown>>,
  calls: Array<{ name: string; body: Readonly<Record<string, unknown>> }> = [],
): PostgrestGateway {
  return {
    async rpc<T>(name: string, body: Readonly<Record<string, unknown>>) {
      calls.push({ name, body });
      return values[name] as T;
    },
  };
}

const validBootstrapRow = {
  deployment_id: 'blackrose-primary',
  writer_epoch: 7,
  mode: 'active',
  backend_base_url: 'https://api.example.test',
  database_fingerprint: 'sha256:primary',
  writer_lease_id: '00000000-0000-4000-8000-000000000077',
  writer_lease_expires_at: '2099-07-28T00:00:00+00:00',
  writer_lease_issuer: 'rosebud-operator',
  writer_lease_key_id: 'operator-key-1',
  source_credential_fingerprint: 'sha256:source-a',
};

describe('memory repository', () => {
  it('maps the three owner-scoped read RPCs and validates their rows', async () => {
    const calls: Array<{
      name: string;
      body: Readonly<Record<string, unknown>>;
    }> = [];
    const repository = createMemoryRepository(gatewayWith({
      memory_get_bootstrap: [validBootstrapRow],
      memory_get_owner_state: [{
        authority_state: 'SHADOW',
        authority_version: 4,
        feature_flags: featureFlags,
      }],
      memory_get_source_inventory: [{
        conversation_count: 3,
        message_count: 12,
        oldest_authored_at: '2026-01-01T01:02:03+00:00',
        newest_authored_at: null,
      }],
    }, calls));

    assert.deepEqual(await repository.getBootstrap(), {
      deploymentId: 'blackrose-primary',
      writerEpoch: 7,
      mode: 'active',
      backendBaseUrl: 'https://api.example.test',
      databaseFingerprint: 'sha256:primary',
      writerLeaseId: '00000000-0000-4000-8000-000000000077',
      writerLeaseExpiresAt: '2099-07-28T00:00:00.000Z',
      writerLeaseIssuer: 'rosebud-operator',
      writerLeaseKeyId: 'operator-key-1',
      sourceCredentialFingerprint: 'sha256:source-a',
    });
    assert.deepEqual(await repository.getOwnerState(ownerId), {
      authorityState: 'SHADOW',
      authorityVersion: 4,
      featureFlags,
    });
    assert.deepEqual(await repository.getSourceInventory(ownerId), {
      conversationCount: 3,
      messageCount: 12,
      oldestAuthoredAt: '2026-01-01T01:02:03.000Z',
      newestAuthoredAt: null,
    });
    assert.deepEqual(calls, [
      { name: 'memory_get_bootstrap', body: {} },
      { name: 'memory_get_owner_state', body: { p_owner_id: ownerId } },
      { name: 'memory_get_source_inventory', body: { p_owner_id: ownerId } },
    ]);
  });

  it('returns null only for an absent owner state', async () => {
    const repository = createMemoryRepository(gatewayWith({
      memory_get_owner_state: [],
    }));
    assert.equal(await repository.getOwnerState(ownerId), null);
  });

  it('fails closed on malformed or ambiguous bootstrap rows', async () => {
    for (const value of [
      [],
      [validBootstrapRow, validBootstrapRow],
      [{ ...validBootstrapRow, writer_epoch: 0 }],
      [{ ...validBootstrapRow, mode: 'unknown' }],
      [{ ...validBootstrapRow, writer_lease_id: 'not-a-uuid' }],
      [{ ...validBootstrapRow, writer_lease_expires_at: 'not-a-date' }],
      [{ ...validBootstrapRow, writer_lease_token_digest: 'must-not-help' }],
    ]) {
      const repository = createMemoryRepository(gatewayWith({
        memory_get_bootstrap: value,
      }));
      await assert.rejects(
        repository.getBootstrap(),
        (error: unknown) => error instanceof MemoryRepositoryError
          && error.code === 'MEMORY_DATA_INVALID',
      );
    }
  });

  it('fails closed on malformed state and inventory rows', async () => {
    const invalidCases = [
      {
        method: 'state',
        value: [{ authority_state: 'CLOUD', authority_version: 1, feature_flags: {} }],
      },
      {
        method: 'state',
        value: [{ authority_state: 'LOCAL', authority_version: 0, feature_flags: featureFlags }],
      },
      {
        method: 'inventory',
        value: [{ conversation_count: -1, message_count: 0, oldest_authored_at: null, newest_authored_at: null }],
      },
      {
        method: 'inventory',
        value: [{ conversation_count: 1, message_count: 1, oldest_authored_at: 'bad', newest_authored_at: null }],
      },
    ] as const;

    for (const item of invalidCases) {
      const repository = createMemoryRepository(gatewayWith({
        memory_get_owner_state: item.value,
        memory_get_source_inventory: item.value,
      }));
      const operation = item.method === 'state'
        ? repository.getOwnerState(ownerId)
        : repository.getSourceInventory(ownerId);
      await assert.rejects(
        operation,
        (error: unknown) => error instanceof MemoryRepositoryError
          && error.code === 'MEMORY_DATA_INVALID',
      );
    }
  });
});
