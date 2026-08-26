import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createUserModelKeyService } from '../userModelKeyService';

interface FakeDeps {
  adapter: {
    createKey: (input: { name: string; allowedModels?: string[] }) => Promise<{ id: string; key: string }>;
    updateKey: (id: string, patch: { allowedModels?: string[] }) => Promise<unknown>;
    revokeKey: (id: string) => Promise<unknown>;
  };
  repository: {
    getUserKey: (userId: string) => Promise<{
      userId: string;
      omnirouteKeyId: string;
      encryptedKey: string;
      allowedModels: string[];
      revokedAt: string | null;
    } | null>;
    putUserKey: (row: unknown) => Promise<void>;
    markRevoked: (userId: string) => Promise<void>;
  };
  encrypt: (secret: string) => Promise<string>;
  decrypt: (cipher: string) => Promise<string>;
  calls: Record<string, unknown[][]>;
}

function makeDeps(): FakeDeps {
  const calls: Record<string, unknown[][]> = {
    createKey: [], updateKey: [], revokeKey: [],
    getUserKey: [], putUserKey: [], markRevoked: [], encrypt: [], decrypt: [],
  };
  return {
    calls,
    adapter: {
      createKey: async (...args) => {
        calls.createKey.push(args);
        return { id: 'ok1', key: 'sk-full' };
      },
      updateKey: async (...args) => {
        calls.updateKey.push(args);
        return {};
      },
      revokeKey: async (...args) => {
        calls.revokeKey.push(args);
        return {};
      },
    },
    repository: {
      getUserKey: async (...args) => {
        calls.getUserKey.push(args);
        return null;
      },
      putUserKey: async (...args) => {
        calls.putUserKey.push(args);
      },
      markRevoked: async (...args) => {
        calls.markRevoked.push(args);
      },
    },
    encrypt: async (...args) => {
      calls.encrypt.push(args);
      return `enc:${args[0] as string}`;
    },
    decrypt: async (...args) => {
      calls.decrypt.push(args);
      return (args[0] as string).replace('enc:', '');
    },
  };
}

describe('user model key service', () => {
  it('creates and stores a scoped key on first use', async () => {
    const deps = makeDeps();
    const svc = createUserModelKeyService(deps);
    await assert.equal(await svc.ensureUserKey('u1', ['m1']), 'sk-full');
    assert.deepEqual(deps.calls.createKey, [[{ name: 'brj-u1', allowedModels: ['m1'] }]]);
    assert.equal(deps.calls.putUserKey.length, 1);
    const row = deps.calls.putUserKey[0][0] as Record<string, unknown>;
    assert.equal(row.userId, 'u1');
    assert.equal(row.omnirouteKeyId, 'ok1');
    assert.equal(row.encryptedKey, 'enc:sk-full');
    assert.deepEqual(row.allowedModels, ['m1']);
    assert.equal(row.revokedAt, null);
  });

  it('reuses the cached key when allowed models are unchanged', async () => {
    const deps = makeDeps();
    deps.repository.getUserKey = async () => ({
      userId: 'u1', omnirouteKeyId: 'ok1', encryptedKey: 'enc:sk-old',
      allowedModels: ['m1'], revokedAt: null,
    });
    const svc = createUserModelKeyService(deps);
    await assert.equal(await svc.ensureUserKey('u1', ['m1']), 'sk-old');
    assert.equal(deps.calls.createKey.length, 0);
    assert.equal(deps.calls.updateKey.length, 0);
    assert.equal(deps.calls.putUserKey.length, 0);
  });

  it('patches allowedModels on the existing key instead of recreating', async () => {
    const deps = makeDeps();
    deps.repository.getUserKey = async () => ({
      userId: 'u1', omnirouteKeyId: 'ok1', encryptedKey: 'enc:sk-old',
      allowedModels: ['m1'], revokedAt: null,
    });
    const svc = createUserModelKeyService(deps);
    await assert.equal(await svc.ensureUserKey('u1', ['m2']), 'sk-old');
    assert.deepEqual(deps.calls.updateKey, [['ok1', { allowedModels: ['m2'] }]]);
    assert.equal(deps.calls.createKey.length, 0);
    const rows = deps.calls.putUserKey;
    assert.equal(rows.length, 1);
    assert.deepEqual((rows[0][0] as Record<string, unknown>).allowedModels, ['m2']);
  });

  it('ignores model order when comparing allowed models', async () => {
    const deps = makeDeps();
    deps.repository.getUserKey = async () => ({
      userId: 'u1', omnirouteKeyId: 'ok1', encryptedKey: 'enc:sk-old',
      allowedModels: ['a', 'b'], revokedAt: null,
    });
    const svc = createUserModelKeyService(deps);
    await assert.equal(await svc.ensureUserKey('u1', ['b', 'a']), 'sk-old');
    assert.equal(deps.calls.updateKey.length, 0);
  });

  it('creates a fresh key after revocation and clears revokedAt', async () => {
    let call = 0;
    const deps = makeDeps();
    deps.repository.getUserKey = async () => ({
      userId: 'u1', omnirouteKeyId: call === 0 ? 'ok0' : 'ok1',
      encryptedKey: 'enc:sk-old', allowedModels: ['m1'],
      revokedAt: call === 0 ? '2026-08-26T00:00:00.000Z' : null,
    });
    const originalPut = deps.repository.putUserKey;
    deps.repository.putUserKey = async (row) => {
      if ((row as Record<string, unknown>).omnirouteKeyId === 'ok1') call = 1;
      await originalPut(row);
    };
    const svc = createUserModelKeyService(deps);
    await assert.equal(await svc.ensureUserKey('u1', ['m1']), 'sk-full');
    assert.equal(deps.calls.createKey.length, 1);
    assert.equal(deps.calls.revokeKey.length, 0);
  });

  it('revoking deletes the upstream key and marks the row revoked', async () => {
    const deps = makeDeps();
    const svc = createUserModelKeyService(deps);
    await svc.revokeUserKey('u1');
    // no stored key -> nothing upstream to delete
    deps.repository.getUserKey = async () => ({
      userId: 'u1', omnirouteKeyId: 'ok9', encryptedKey: 'enc:sk-x',
      allowedModels: [], revokedAt: null,
    });
    await svc.revokeUserKey('u1');
    assert.deepEqual(deps.calls.revokeKey, [['ok9']]);
    assert.equal(deps.calls.markRevoked.length, 2);
  });

  it('setAllowedModels patches without recreating', async () => {
    const deps = makeDeps();
    deps.repository.getUserKey = async () => ({
      userId: 'u1', omnirouteKeyId: 'ok1', encryptedKey: 'enc:sk-old',
      allowedModels: ['m1'], revokedAt: null,
    });
    const svc = createUserModelKeyService(deps);
    await svc.setAllowedModels('u1', ['m3']);
    assert.deepEqual(deps.calls.updateKey, [['ok1', { allowedModels: ['m3'] }]]);
    assert.equal(deps.calls.createKey.length, 0);
    assert.equal(deps.calls.putUserKey.length, 1);
  });

  it('throws when no active key exists for setAllowedModels', async () => {
    const deps = makeDeps();
    const svc = createUserModelKeyService(deps);
    await assert.rejects(() => svc.setAllowedModels('u1', ['m3']));
    assert.equal(deps.calls.createKey.length, 0);
  });
});
