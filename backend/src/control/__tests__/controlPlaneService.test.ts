import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ControlPlaneConflictError,
  ControlPlaneRepositoryConflictError,
  ControlPlaneValidationError,
  createControlPlaneService,
} from '../controlPlaneService';
import type { DiscoveredProviderModel } from '../controlPlaneTypes';
import { masterKeys, model, provider, repositoryStub } from './controlPlaneTestFixtures';

describe('AI control plane service', () => {
  it('stores an encrypted provider credential and returns only safe metadata', async () => {
    let storedSecret = '';
    const audits: string[] = [];
    const service = createControlPlaneService({
      repository: repositoryStub({
        replaceProviderCredential: async (_id, envelope) => {
          storedSecret = envelope.ciphertext;
          return undefined;
        },
        appendAudit: async (event) => { audits.push(event.action); },
      }),
      masterKeys,
      discover: async () => [],
      validateEndpoint: async () => undefined,
    });

    const result = await service.createProvider('admin-1', {
      name: provider.name,
      protocol: provider.protocol,
      baseUrl: provider.baseUrl,
      displayMetadata: provider.displayMetadata,
      discoveryConfig: provider.discoveryConfig,
      credential: { secret: 'sk-super-secret', label: 'production' },
    });

    assert.notEqual(storedSecret, 'sk-super-secret');
    assert.doesNotMatch(JSON.stringify(result), /sk-super-secret|ciphertext|nonce/i);
    assert.deepEqual(audits, ['provider.create']);
  });

  it('decrypts only for discovery and persists the normalized inventory', async () => {
    let outboundSecret = '';
    let persisted: readonly DiscoveredProviderModel[] = [];
    let persistedExpectedRevision: number | undefined;
    const service = createControlPlaneService({
      repository: repositoryStub({
        getProviderCredential: async () => ({
          version: 1,
          algorithm: 'A256GCM',
          keyVersion: 3,
          nonce: 'AAAAAAAAAAAAAAAA',
          ciphertext: 'invalid-for-this-test',
          authenticationTag: 'AAAAAAAAAAAAAAAAAAAAAA',
        }),
        replaceDiscoveredModels: async (_id, models, expectedRevision) => {
          persisted = models;
          persistedExpectedRevision = expectedRevision;
          return [model];
        },
      }),
      masterKeys,
      decryptCredential: async () => 'sk-discovery-only',
      validateEndpoint: async () => undefined,
      discover: async (_provider, secret) => {
        outboundSecret = secret;
        return [model];
      },
    });

    const result = await service.discoverProvider('admin-1', provider.id, 1);

    assert.equal(outboundSecret, 'sk-discovery-only');
    assert.deepEqual(persisted, [model]);
    assert.equal(persistedExpectedRevision, 1);
    assert.doesNotMatch(JSON.stringify(result), /sk-discovery-only/i);
  });

  it('returns safe current state when an expected revision is stale', async () => {
    const service = createControlPlaneService({
      repository: repositoryStub(),
      masterKeys,
      discover: async () => [],
      validateEndpoint: async () => undefined,
    });

    await assert.rejects(
      () => service.updateProvider('admin-1', provider.id, {
        expectedRevision: 99,
        name: 'Changed',
      }),
      (error: unknown) => error instanceof ControlPlaneConflictError
        && error.currentRevision === 1
        && error.currentState.id === provider.id,
    );
  });

  it('archives discovered models through the withdrawal RPC and records an audit event', async () => {
    const audits: string[] = [];
    const service = createControlPlaneService({
      repository: repositoryStub({
        appendAudit: async (event) => { audits.push(event.action); },
      }),
      masterKeys,
      discover: async () => [],
      validateEndpoint: async () => undefined,
    });

    const archived = await service.archiveProviderModel('admin-1', model.id, 1);

    assert.equal(archived.id, model.id);
    assert.deepEqual(audits, ['provider_model.archive']);
  });

  it('rejects an unsafe provider endpoint before creating a database record', async () => {
    let created = false;
    const service = createControlPlaneService({
      repository: repositoryStub({
        createProvider: async () => {
          created = true;
          return provider;
        },
      }),
      masterKeys,
      discover: async () => [],
      validateEndpoint: async () => { throw new Error('unsafe'); },
    });

    await assert.rejects(
      () => service.createProvider('admin-1', {
        name: 'Unsafe',
        protocol: 'openai-chat-completions',
        baseUrl: 'https://127.0.0.1/v1',
        credential: { secret: 'secret' },
      }),
      ControlPlaneValidationError,
    );
    assert.equal(created, false);
  });

  it('returns the current user preference when a concurrent update wins the race', async () => {
    const current = {
      selectedModelId: 'catalog-current',
      revision: 5,
      updatedAt: '2026-08-24T00:00:00.000Z',
    };
    const service = createControlPlaneService({
      repository: repositoryStub({
        getPreference: async () => current,
        updatePreference: async () => { throw new ControlPlaneRepositoryConflictError(); },
      }),
      masterKeys,
      discover: async () => [],
      validateEndpoint: async () => undefined,
    });

    await assert.rejects(
      () => service.updatePreference('user-1', { modelId: 'catalog-stale', expectedRevision: 4 }),
      (error: unknown) => error instanceof ControlPlaneConflictError
        && error.currentRevision === 5
        && error.currentState.selectedModelId === 'catalog-current',
    );
  });

  it('reports provider health without returning credentials or upstream bodies', async () => {
    const service = createControlPlaneService({
      repository: repositoryStub({
        getProviderCredential: async () => ({
          version: 1,
          algorithm: 'A256GCM',
          keyVersion: 3,
          nonce: Buffer.alloc(12, 1).toString('base64url'),
          ciphertext: Buffer.from('encrypted').toString('base64url'),
          authenticationTag: Buffer.alloc(16, 2).toString('base64url'),
        }),
      }),
      masterKeys,
      decryptCredential: async () => 'health-secret',
      discover: async () => [model],
      validateEndpoint: async () => undefined,
    });

    const health = await service.getProviderHealth(provider.id);

    assert.equal(health.status, 'healthy');
    assert.equal(health.modelCount, 1);
    assert.doesNotMatch(JSON.stringify(health), /health-secret|ciphertext/i);
  });

  it('rekeys an existing credential to the current master-key version without exposing plaintext', async () => {
    let stored: { keyVersion: number; ciphertext: string } | undefined;
    const service = createControlPlaneService({
      repository: repositoryStub({
        getProviderCredential: async () => ({
          version: 1,
          algorithm: 'A256GCM',
          keyVersion: 1,
          nonce: Buffer.alloc(12, 1).toString('base64url'),
          ciphertext: Buffer.from('old-encrypted').toString('base64url'),
          authenticationTag: Buffer.alloc(16, 2).toString('base64url'),
          lastFour: '1234',
        }),
        replaceProviderCredential: async (_id, credential) => {
          stored = { keyVersion: credential.keyVersion, ciphertext: credential.ciphertext };
          return { ...provider, revision: 2 };
        },
      }),
      masterKeys,
      decryptCredential: async () => 'plaintext-for-rekey',
      discover: async () => [],
      validateEndpoint: async () => undefined,
    });

    const result = await service.rekeyProviderCredential('admin-1', provider.id, 1);

    assert.equal(stored?.keyVersion, 3);
    assert.notEqual(stored?.ciphertext, 'plaintext-for-rekey');
    assert.doesNotMatch(JSON.stringify(result), /plaintext-for-rekey|ciphertext/i);
  });
});
