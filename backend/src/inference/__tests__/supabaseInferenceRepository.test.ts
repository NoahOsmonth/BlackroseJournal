import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSupabaseInferenceRepository } from '../supabaseInferenceRepository';

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status });
}

const route = {
  id: 'route-1',
  catalog_model_id: 'catalog-1',
  provider_model_id: 'model-row-1',
  purpose: 'chat',
  state: 'active',
  priority: 0,
  max_input_bytes: 1000,
  max_output_tokens: 500,
  request_timeout_ms: 2000,
};

const model = {
  id: 'model-row-1', provider_id: 'provider-1', upstream_model_id: 'upstream-model',
  state: 'active', capabilities: {
    streaming: true, tools: true, vision: false, jsonObject: true, jsonSchema: false,
  },
};

const provider = {
  id: 'provider-1', protocol: 'openai-responses', base_url: 'https://models.example/v1',
  state: 'active',
};

const credential = {
  key_version: 2,
  nonce: '\\x010101010101010101010101',
  ciphertext: '\\x656e63727970746564',
  authentication_tag: '\\x02020202020202020202020202020202',
};

const runtime = {
  active_flash_route_id: 'flash-route-1', max_input_bytes: 900,
  max_output_tokens: 400, request_timeout_ms: 1500, revision: 2,
  updated_at: '2026-08-24T00:00:00.000Z',
};

describe('Supabase managed inference repository', () => {
  it('resolves chat only through the authenticated user selection and one active fixed route', async () => {
    const urls: string[] = [];
    const responses = [
      [{ user_id: 'user-1', selected_model_id: 'catalog-1' }],
      [route], [runtime], [model], [provider], [credential],
    ];
    const repository = createSupabaseInferenceRepository({
      restUrl: 'https://project.supabase.co/rest/v1',
      secretKey: 'server-secret',
      fetcher: async (input) => {
        urls.push(input.toString());
        return json(responses.shift() ?? []);
      },
    });

    const binding = await repository.resolveRoute('user-1', 'chat');

    assert.equal(binding?.routeId, 'route-1');
    assert.equal(binding?.modelId, 'upstream-model');
    assert.equal(binding?.protocol, 'openai-responses');
    assert.equal(binding?.capabilities.jsonObject, true);
    assert.equal(binding?.maxInputBytes, 900);
    assert.equal(binding?.maxOutputTokens, 400);
    assert.equal(binding?.requestTimeoutMs, 1500);
    assert.match(urls[0], /user_ai_preferences.*user_id=eq\.user-1/);
    assert.match(urls[1], /catalog_model_id=eq\.catalog-1/);
    assert.doesNotMatch(JSON.stringify(binding), /server-secret/);
  });

  it('resolves flash only from the singleton active flash route, never user preference', async () => {
    const urls: string[] = [];
    const responses = [
      [runtime], [{ ...route, id: 'flash-route-1', catalog_model_id: null, purpose: 'flash' }],
      [model], [provider], [credential],
    ];
    const repository = createSupabaseInferenceRepository({
      restUrl: 'https://project.supabase.co/rest/v1', secretKey: 'server-secret',
      fetcher: async (input) => {
        urls.push(input.toString());
        return json(responses.shift() ?? []);
      },
    });

    const binding = await repository.resolveRoute('user-1', 'flash');

    assert.equal(binding?.routeId, 'flash-route-1');
    assert.equal(urls.some((url) => url.includes('user_ai_preferences')), false);
  });

  it('records bounded usage metadata without prompts, provider keys, or response content', async () => {
    let body = '';
    const repository = createSupabaseInferenceRepository({
      restUrl: 'https://project.supabase.co/rest/v1', secretKey: 'server-secret',
      fetcher: async (_input, init) => {
        body = String(init?.body ?? '');
        return new Response(null, { status: 201 });
      },
    });

    await repository.appendUsage({
      userId: 'user-1', routeId: 'route-1', status: 'succeeded',
      inputTokens: 12, outputTokens: 4, latencyMs: 50,
    });

    assert.match(body, /"input_tokens":12/);
    assert.doesNotMatch(body, /prompt|message|content|server-secret/i);
  });
});
