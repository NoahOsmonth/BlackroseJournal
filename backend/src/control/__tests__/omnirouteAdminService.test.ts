import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  OmnirouteAdminValidationError,
  OmnirouteConfirmationError,
  createOmnirouteAdminService,
  type OmniroutePublishedModelsStore,
  type PublishedModelRow,
} from '../omnirouteAdminService';

function memoryStore(initial: PublishedModelRow[] = []): OmniroutePublishedModelsStore & {
  rows: PublishedModelRow[];
} {
  const rows = [...initial];
  return {
    rows,
    async list() {
      return rows.map((row) => ({ ...row }));
    },
    async upsert(incoming) {
      for (const row of incoming) {
        const existing = rows.findIndex((candidate) => candidate.modelId === row.modelId);
        if (existing >= 0) rows[existing] = { ...row };
        else rows.push({ ...row });
      }
    },
    async remove(modelIds) {
      const drop = new Set(modelIds);
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        if (drop.has(rows[index].modelId)) rows.splice(index, 1);
      }
    },
  };
}

function service(overrides: Partial<Parameters<typeof createOmnirouteAdminService>[0]> = {}) {
  const store = (overrides.store ?? memoryStore()) as OmniroutePublishedModelsStore & {
    rows: PublishedModelRow[];
  };
  const auditEvents: Record<string, unknown>[] = [];
  const svc = createOmnirouteAdminService({
    adapter: {
      listProviders: async () => [{ id: 'p1', name: 'openrouter' }],
      createProvider: async () => ({}),
      testProvider: async (id) => ({ valid: id === 'p1', latencyMs: 42 }),
      listCombos: async () => [
        { id: 'meta-llama/l-3:free', models: ['meta-llama/l-3:free'] },
        { id: 'paid/model-pro', models: ['paid/model-pro'] },
      ],
      upsertCombo: async () => ({}),
      listKeys: async () => [],
      createKey: async () => ({ id: 'k', key: 'sk' }),
      updateKey: async () => ({}),
      revokeKey: async () => ({}),
    },
    store,
    audit: async (event) => {
      auditEvents.push(event);
    },
    ...overrides,
  });
  return { svc, store, auditEvents };
}

describe('omniroute admin service', () => {
  it('lists providers and tests through the adapter', async () => {
    const { svc } = service();
    assert.deepEqual(await svc.listProviders(), [{ id: 'p1', name: 'openrouter' }]);
    assert.deepEqual(await svc.testProvider('p1'), { valid: true, latencyMs: 42 });
  });

  it('filters the model catalog to free models only', async () => {
    const { svc } = service();
    const models = await svc.listModels();
    assert.equal(models.length, 1);
    assert.equal((models[0] as { id: string }).id, 'meta-llama/l-3:free');
  });

  it('upserts and removes published free models and writes an audit entry', async () => {
    const { svc, store, auditEvents } = service();
    const published = await svc.updatePublishedModels('admin-1', {
      upserts: [{ modelId: 'qwen/q-2:free', label: 'Qwen 2 Free' }],
      removes: [],
    });
    assert.deepEqual(published, [{ modelId: 'qwen/q-2:free', label: 'Qwen 2 Free' }]);
    await svc.updatePublishedModels('admin-1', {
      upserts: [],
      removes: ['qwen/q-2:free'],
    });
    assert.deepEqual(store.rows, []);
    assert.equal(auditEvents.length, 2);
    assert.equal(auditEvents[0].action, 'omniroute.published_models.update');
    assert.equal(auditEvents[0].actorUserId, 'admin-1');
  });

  it('refuses to publish non-free models', async () => {
    const { svc } = service();
    await assert.rejects(
      () => svc.updatePublishedModels('admin-1', {
        upserts: [{ modelId: 'paid/model-pro', label: 'Pro' }],
        removes: [],
      }),
      OmnirouteAdminValidationError,
    );
  });

  it('disconnect is allowlist removal only and demands the exact confirmation phrase', async () => {
    const { svc, store } = service({
      store: memoryStore([
        { modelId: 'openrouter/a:free', label: 'A' },
        { modelId: 'other/b:free', label: 'B' },
      ]),
    });
    await assert.rejects(
      () => svc.disconnectProvider('admin-1', 'openrouter', 'openrouter'),
      OmnirouteConfirmationError,
    );
    assert.equal(store.rows.length, 2, 'nothing removed without confirmation');
    const published = await svc.disconnectProvider(
      'admin-1',
      'openrouter',
      'DELETE PROVIDER openrouter',
    );
    assert.deepEqual(published, [{ modelId: 'other/b:free', label: 'B' }]);
  });
});
