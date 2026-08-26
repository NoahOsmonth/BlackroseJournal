import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createOmnirouteKeysService } from '../omnirouteKeysService';

function makeDeps(overrides: Partial<Parameters<typeof createOmnirouteKeysService>[0]> = {}) {
  const calls: string[] = [];
  const row = {
    omnirouteKeyId: 'key-1',
    encryptedKey: 'cipher',
    allowedModels: ['m:free'],
    revokedAt: null,
  };
  return {
    calls,
    deps: {
      adapter: {
        listKeys: async () => [
          { id: 'key-1', name: 'brj-user-1', usage: { requests: 5, totalTokens: 120 } },
          { id: 'key-2', name: 'other-key', usage: { requests: 9, totalTokens: 1 } },
        ],
        revokeKey: async (id: string) => {
          calls.push(`revoke:${id}`);
          return {};
        },
        updateKey: async (id: string, patch: unknown) => {
          calls.push(`update:${id}:${JSON.stringify(patch)}`);
          return {};
        },
      },
      getUserKeyRow: async () => ({ ...row }),
      decrypt: async () => 'sk-full-secret-value-1234567890',
      getEmbeddingModel: () => 'embed:free' as string | null,
      setEmbeddingModel: async (model: string | null) => {
        calls.push(`embedding:${model}`);
      },
      ...overrides,
    } as Parameters<typeof createOmnirouteKeysService>[0],
  };
}

describe('omniroute keys service (Task 7)', () => {
  it('returns a masked key view and never the full secret', async () => {
    const { deps } = makeDeps();
    const service = createOmnirouteKeysService(deps);
    const view = await service.getUserKeyView('user-1');
    assert.ok(view);
    assert.equal(view.maskedKey.startsWith('sk-f'), true);
    assert.ok(view.maskedKey.includes('••••'));
    assert.equal(view.maskedKey.includes('secret'), false);
    assert.deepEqual(view.allowedModels, ['m:free']);
  });

  it('returns null for missing or revoked keys', async () => {
    const { deps } = makeDeps({
      getUserKeyRow: async () => null,
    });
    const service = createOmnirouteKeysService(deps);
    assert.equal(await service.getUserKeyView('nobody'), null);
  });

  it('PATCHes allowed models on the existing key (never recreates)', async () => {
    const { deps, calls } = makeDeps();
    const service = createOmnirouteKeysService(deps);
    await service.setAllowedModels('user-1', ['a:free', 'b:free']);
    assert.deepEqual(calls, ['update:key-1:{"allowedModels":["a:free","b:free"]}']);
  });

  it('rejects paid models in allowed-models updates', async () => {
    const { deps } = makeDeps();
    const service = createOmnirouteKeysService(deps);
    await assert.rejects(
      () => service.setAllowedModels('user-1', ['paid/model']),
      /not a free model/,
    );
  });

  it('refuses allowed-model edits with no active key', async () => {
    const { deps } = makeDeps({ getUserKeyRow: async () => null });
    const service = createOmnirouteKeysService(deps);
    await assert.rejects(() => service.setAllowedModels('user-1', ['a:free']), /No active key/);
  });

  it('revokes via the adapter', async () => {
    const { deps, calls } = makeDeps();
    const service = createOmnirouteKeysService(deps);
    await service.revokeUserKey('user-1');
    assert.deepEqual(calls, ['revoke:key-1']);
  });

  it('filters usage rows to brj-<userId> keys only', async () => {
    const { deps } = makeDeps();
    const service = createOmnirouteKeysService(deps);
    const usage = await service.listUsage();
    assert.equal(usage.length, 1);
    assert.equal(usage[0].keyName, 'brj-user-1');
    assert.equal(usage[0].requests, 5);
    assert.equal(usage[0].totalTokens, 120);
  });

  it('reads embeddings settings from config surface', async () => {
    const { deps } = makeDeps();
    const service = createOmnirouteKeysService(deps);
    assert.deepEqual(await service.getEmbeddingsSettings(), { embeddingModel: 'embed:free' });
  });

  it('toggles embeddings model on/off with free-only validation', async () => {
    const { deps, calls } = makeDeps();
    const service = createOmnirouteKeysService(deps);
    const off = await service.setEmbeddingsSettings(null);
    assert.deepEqual(off, { embeddingModel: null });
    const on = await service.setEmbeddingsSettings('new:free');
    assert.deepEqual(on, { embeddingModel: 'new:free' });
    await assert.rejects(() => service.setEmbeddingsSettings('paid/model'), /not a free model/);
    assert.deepEqual(calls.filter((c) => c.startsWith('embedding:')), [
      'embedding:null',
      'embedding:new:free',
    ]);
  });
});
