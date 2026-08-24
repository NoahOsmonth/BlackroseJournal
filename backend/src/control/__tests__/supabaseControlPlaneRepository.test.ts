import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createSupabaseControlPlaneRepository,
  SupabaseControlRepositoryConflictError,
} from '../supabaseControlPlaneRepository';

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('Supabase control plane repository', () => {
  it('uses the private control profile and maps provider rows without exposing credentials', async () => {
    let requestedUrl = '';
    let headers = new Headers();
    const repository = createSupabaseControlPlaneRepository({
      restUrl: 'https://project.supabase.co/rest/v1',
      secretKey: 'service-secret',
      fetcher: async (input, init) => {
        requestedUrl = input.toString();
        headers = new Headers(init?.headers);
        return jsonResponse([{
          id: 'provider-1',
          name: 'Example',
          protocol: 'openai-responses',
          base_url: 'https://models.example/v1',
          state: 'active',
          revision: 4,
          display_metadata: { label: 'Example' },
          discovery_config: { modelsPath: '/models' },
          created_at: '2026-08-24T00:00:00.000Z',
          updated_at: '2026-08-24T00:00:00.000Z',
        }]);
      },
    });

    const providers = await repository.listProviders();

    assert.match(requestedUrl, /\/providers\?/);
    assert.equal(headers.get('accept-profile'), 'control');
    assert.equal(headers.get('authorization'), 'Bearer service-secret');
    assert.equal(providers[0].baseUrl, 'https://models.example/v1');
    assert.doesNotMatch(JSON.stringify(providers), /service-secret|ciphertext/i);
  });

  it('writes encrypted credential bytes and safe metadata without plaintext', async () => {
    let requestBody = '';
    const repository = createSupabaseControlPlaneRepository({
      restUrl: 'https://project.supabase.co/rest/v1',
      secretKey: 'service-secret',
      fetcher: async (_input, init) => {
        requestBody = String(init?.body ?? '');
        return jsonResponse([], 201);
      },
    });

    await repository.replaceProviderCredential('provider-1', {
      version: 1,
      algorithm: 'A256GCM',
      keyVersion: 2,
      nonce: Buffer.alloc(12, 1).toString('base64url'),
      ciphertext: Buffer.from('encrypted-bytes').toString('base64url'),
      authenticationTag: Buffer.alloc(16, 2).toString('base64url'),
      label: 'production',
      lastFour: '1234',
    });

    assert.match(requestBody, /"ciphertext":"\\\\x/);
    assert.match(requestBody, /"key_version":2/);
    assert.doesNotMatch(requestBody, /plaintext|service-secret/);
  });

  it('turns zero-row optimistic updates into a revision conflict', async () => {
    const repository = createSupabaseControlPlaneRepository({
      restUrl: 'https://project.supabase.co/rest/v1',
      secretKey: 'service-secret',
      fetcher: async () => jsonResponse([]),
    });

    await assert.rejects(
      () => repository.updateProvider('provider-1', {
        expectedRevision: 9,
        name: 'Changed',
      }),
      SupabaseControlRepositoryConflictError,
    );
  });

  it('publishes through the transactional RPC with both provider and catalog revisions', async () => {
    let requestedUrl = '';
    let requestBody = '';
    const repository = createSupabaseControlPlaneRepository({
      restUrl: 'https://project.supabase.co/rest/v1',
      secretKey: 'service-secret',
      fetcher: async (input, init) => {
        requestedUrl = input.toString();
        requestBody = String(init?.body ?? '');
        return jsonResponse({
          id: 'catalog-1',
          label: 'Alpha',
          public_model_id: 'managed/alpha',
          capabilities: {
            streaming: true, tools: true, vision: false, jsonObject: true, jsonSchema: false,
          },
          context_window: 32768,
          availability: 'available',
          sort_order: 2,
          revision: 8,
          created_at: '2026-08-24T00:00:00.000Z',
          updated_at: '2026-08-24T00:00:00.000Z',
        });
      },
    });

    const published = await repository.publishCatalogModel('provider-1', {
      expectedRevision: 4,
      providerModelId: 'provider-model-1',
      label: 'Alpha',
      publicModelId: 'managed/alpha',
      capabilities: {
        streaming: true, tools: true, vision: false, jsonObject: true, jsonSchema: false,
      },
      contextWindow: 32768,
      sortOrder: 2,
      purpose: 'chat',
    }, 7);

    assert.match(requestedUrl, /\/rpc\/publish_catalog_model$/);
    assert.match(requestBody, /"p_expected_provider_revision":4/);
    assert.match(requestBody, /"p_expected_catalog_revision":7/);
    assert.equal(published.publicModelId, 'managed/alpha');
  });

  it('keeps audit history readable after a deleted actor is set to null', async () => {
    const repository = createSupabaseControlPlaneRepository({
      restUrl: 'https://project.supabase.co/rest/v1',
      secretKey: 'service-secret',
      fetcher: async () => jsonResponse([{
        id: 12,
        actor_user_id: null,
        action: 'provider.archive',
        resource_type: 'provider',
        resource_id: 'provider-1',
        before_metadata: null,
        after_metadata: { state: 'archived' },
        created_at: '2026-08-24T00:00:00.000Z',
      }]),
    });

    const events = await repository.listAuditEvents(10);

    assert.equal(events[0].actorUserId, null);
    assert.equal(events[0].action, 'provider.archive');
  });
});
