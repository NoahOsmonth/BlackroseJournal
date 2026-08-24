import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  enforceRequestCeilings,
  validateRequestCeilings,
} from '../requestCeilings';
import {
  executeWithSameRouteRetry,
  RetryExecutionError,
} from '../sameRouteRetry';

describe('managed request ceilings', () => {
  it('rejects input bytes, output tokens, and timeout above configured ceilings', () => {
    const ceilings = validateRequestCeilings({
      maxInputBytes: 128,
      maxOutputTokens: 256,
      requestTimeoutMs: 2_000,
    });

    assert.throws(() => enforceRequestCeilings({
      inputBytes: 129,
      maxOutputTokens: 100,
      requestTimeoutMs: 1_000,
    }, ceilings), /input/i);
    assert.throws(() => enforceRequestCeilings({
      inputBytes: 100,
      maxOutputTokens: 257,
      requestTimeoutMs: 1_000,
    }, ceilings), /output/i);
    assert.throws(() => enforceRequestCeilings({
      inputBytes: 100,
      maxOutputTokens: 100,
      requestTimeoutMs: 2_001,
    }, ceilings), /timeout/i);
  });

  it('rejects runtime settings above immutable gateway hard limits', () => {
    assert.throws(() => validateRequestCeilings({
      maxInputBytes: 20 * 1024 * 1024,
      maxOutputTokens: 256,
      requestTimeoutMs: 2_000,
    }), /hard limit/i);
  });
});

describe('same-route transient retry', () => {
  it('retries a transient failure with the exact same route and model only', async () => {
    const seen: { routeId: string; modelId: string }[] = [];
    const result = await executeWithSameRouteRetry({
      binding: { routeId: 'route-a', modelId: 'model-a' },
      policy: { maxAttempts: 3, baseDelayMs: 1, maxTotalMs: 1_000 },
      sleep: async () => undefined,
      execute: async (binding, attempt) => {
        seen.push({ ...binding });
        if (attempt === 1) throw new RetryExecutionError('temporary', 503);
        return 'ok';
      },
    });

    assert.equal(result, 'ok');
    assert.deepEqual(seen, [
      { routeId: 'route-a', modelId: 'model-a' },
      { routeId: 'route-a', modelId: 'model-a' },
    ]);
  });

  it('does not retry permanent failures and never exceeds three attempts', async () => {
    let permanentAttempts = 0;
    await assert.rejects(() => executeWithSameRouteRetry({
      binding: { routeId: 'route-a', modelId: 'model-a' },
      policy: { maxAttempts: 3, baseDelayMs: 1, maxTotalMs: 1_000 },
      sleep: async () => undefined,
      execute: async () => {
        permanentAttempts += 1;
        throw new RetryExecutionError('bad request', 400);
      },
    }));
    assert.equal(permanentAttempts, 1);

    let transientAttempts = 0;
    await assert.rejects(() => executeWithSameRouteRetry({
      binding: { routeId: 'route-a', modelId: 'model-a' },
      policy: { maxAttempts: 99, baseDelayMs: 1, maxTotalMs: 1_000 },
      sleep: async () => undefined,
      execute: async () => {
        transientAttempts += 1;
        throw new RetryExecutionError('temporary', 503);
      },
    }));
    assert.equal(transientAttempts, 3);
  });

  it('retries typed adapter errors that explicitly declare themselves retryable', async () => {
    let attempts = 0;
    const result = await executeWithSameRouteRetry({
      binding: { routeId: 'route-a', modelId: 'model-a' },
      policy: { maxAttempts: 2, baseDelayMs: 1, maxTotalMs: 1_000 },
      sleep: async () => undefined,
      execute: async () => {
        attempts += 1;
        if (attempts === 1) throw Object.assign(new Error('generic'), {
          code: 'upstream_error', retryable: true,
        });
        return 'ok';
      },
    });

    assert.equal(result, 'ok');
    assert.equal(attempts, 2);
  });

  it('aborts and rejects an in-flight attempt when the total deadline expires', async () => {
    let aborted = false;
    const startedAt = Date.now();

    await assert.rejects(() => executeWithSameRouteRetry({
      binding: { routeId: 'route-a', modelId: 'model-a' },
      policy: { maxAttempts: 3, baseDelayMs: 1, maxTotalMs: 25 },
      execute: async (_binding, _attempt, signal) => new Promise<string>(() => {
        signal.addEventListener('abort', () => { aborted = true; }, { once: true });
      }),
    }), /deadline/i);

    assert.equal(aborted, true);
    assert.ok(Date.now() - startedAt < 500);
  });
});
