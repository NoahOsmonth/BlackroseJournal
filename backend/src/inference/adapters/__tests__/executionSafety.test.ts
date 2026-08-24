import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  executeProviderInference,
  ProviderAdapterError,
} from '../index';

const input = (overrides: Record<string, unknown> = {}) => ({
  provider: { protocol: 'openai-chat-completions' as const, baseUrl: 'https://provider.example/v1' },
  modelId: 'model-one',
  secret: 'secret-must-not-leak',
  request: { purpose: 'chat' as const, messages: [{ role: 'user' as const, content: 'Hi' }], stream: false },
  ...overrides,
});

const consume = async (events: AsyncIterable<unknown>): Promise<void> => {
  for await (const _event of events) { /* consume */ }
};

describe('provider adapter execution safety', () => {
  it('throws a typed retryable rate-limit error without leaking provider content', async () => {
    const operation = consume(executeProviderInference(input({
      fetchFn: async () => new Response('secret upstream details', { status: 429 }),
    })));

    await assert.rejects(operation, (error: unknown) => {
      assert.ok(error instanceof ProviderAdapterError);
      assert.equal(error.code, 'rate_limited');
      assert.equal(error.status, 429);
      assert.equal(error.retryable, true);
      assert.doesNotMatch(error.message, /secret|provider\.example|model-one/);
      return true;
    });
  });

  it('distinguishes caller cancellation from a bounded upstream timeout', async () => {
    const waitForAbort: typeof fetch = async (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    });
    const caller = new AbortController();
    const cancelled = consume(executeProviderInference(input({ fetchFn: waitForAbort, signal: caller.signal })));
    caller.abort();
    await assert.rejects(cancelled, (error: unknown) =>
      error instanceof ProviderAdapterError && error.code === 'aborted' && !error.retryable);

    const timedOut = consume(executeProviderInference(input({
      fetchFn: waitForAbort,
      limits: { timeoutMs: 5 },
    })));
    await assert.rejects(timedOut, (error: unknown) =>
      error instanceof ProviderAdapterError && error.code === 'upstream_timeout' && error.retryable);
  });

  it('rejects a response that exceeds the configured byte ceiling before parsing it', async () => {
    const operation = consume(executeProviderInference(input({
      limits: { maxResponseBytes: 16 },
      fetchFn: async () => new Response(JSON.stringify({
        choices: [{ message: { content: 'far too much content' }, finish_reason: 'stop' }],
      })),
    })));

    await assert.rejects(operation, (error: unknown) =>
      error instanceof ProviderAdapterError
      && error.code === 'upstream_error'
      && error.retryable === false);
  });
});
