import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createOmnirouteInferenceExecutor } from '../omnirouteInferenceExecutor';

type FetchCall = { url: string; init: RequestInit };

function makeExecutor(
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response>,
  overrides: Partial<Parameters<typeof createOmnirouteInferenceExecutor>[0]> = {},
) {
  const calls: FetchCall[] = [];
  const executor = createOmnirouteInferenceExecutor({
    baseUrl: 'http://omni.test/',
    getUserKey: async (userId) => `sk-user-${userId}`,
    fetcher: (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return fetchImpl(String(url), init);
    },
    ...overrides,
  });
  return { calls, executor };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('omniroute inference executor', () => {
  it('posts chat completions with the per-user bearer key to /v1/chat/completions', async () => {
    let observedBody = '';
    const { calls, executor } = makeExecutor(async (_url, init) => {
      observedBody = String(init?.body ?? '');
      return jsonResponse({ id: 'c1' });
    });
    const res = await executor.chat({
      userId: 'u1',
      model: 'free-model',
      messages: [{ role: 'user', content: 'Hi' }],
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { id: 'c1' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'http://omni.test/v1/chat/completions');
    assert.equal((calls[0].init.headers as Record<string, string>).Authorization, 'Bearer sk-user-u1');
    assert.deepEqual(JSON.parse(observedBody), {
      model: 'free-model',
      messages: [{ role: 'user', content: 'Hi' }],
    });
  });

  it('forwards the abort signal to the upstream request', async () => {
    let observedSignal: AbortSignal | undefined;
    const { executor } = makeExecutor(async (_url, init) => {
      observedSignal = init?.signal ?? undefined;
      return jsonResponse({});
    });
    const controller = new AbortController();
    await executor.chat(
      { userId: 'u1', model: 'm', messages: [] },
      controller.signal,
    );
    assert.equal(observedSignal, controller.signal);
  });

  it('passes a streaming response through untouched', async () => {
    const upstream = new Response('data: {"chunk":1}\n\ndata: [DONE]\n\n', {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
    const { executor } = makeExecutor(async () => upstream);
    const res = await executor.chat({ userId: 'u2', model: 'm', messages: [] });
    assert.equal(res, upstream); // same object — no buffering or transformation
    assert.equal(res.headers.get('content-type'), 'text/event-stream');
    assert.equal(await res.text(), 'data: {"chunk":1}\n\ndata: [DONE]\n\n');
  });

  it('embeds via the configured embedding model and returns vectors', async () => {
    const { calls, executor } = makeExecutor(async () => jsonResponse({
      data: [{ embedding: [1, 2] }, { embedding: [3, 4] }],
    }), { embeddingModel: 'gemini-embedding-001' });
    const vectors = await executor.embed({ userId: 'u1', input: ['a', 'b'] });
    assert.deepEqual(vectors, [[1, 2], [3, 4]]);
    assert.equal(calls[0].url, 'http://omni.test/v1/embeddings');
    assert.equal((calls[0].init.headers as Record<string, string>).Authorization, 'Bearer sk-user-u1');
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
      model: 'gemini-embedding-001',
      input: ['a', 'b'],
    });
  });

  it('throws when embedding is used without a configured model', async () => {
    const { executor } = makeExecutor(async () => jsonResponse({}));
    await assert.rejects(() => executor.embed({ userId: 'u1', input: ['x'] }), /embedding model/);
  });
});
