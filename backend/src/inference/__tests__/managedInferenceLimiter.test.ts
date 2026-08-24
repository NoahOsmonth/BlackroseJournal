import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createInMemoryManagedInferenceLimiter,
  ManagedInferenceLimitError,
} from '../managedInferenceLimiter';

const policy = {
  maxConcurrentPerUser: 1,
  maxRequestsPerWindow: 2,
  maxTokensPerWindow: 100,
  windowMs: 60_000,
  defaultOutputTokenReservation: 20,
};

describe('in-memory managed inference limiter', () => {
  it('enforces per-user concurrency and releases a lease exactly once', async () => {
    const limiter = createInMemoryManagedInferenceLimiter(policy);
    const lease = await limiter.acquire({
      userId: 'user-1', estimatedInputTokens: 10, requestedOutputTokens: 20,
    });

    await assert.rejects(() => limiter.acquire({
      userId: 'user-1', estimatedInputTokens: 1, requestedOutputTokens: 1,
    }), (error: unknown) => (
      error instanceof ManagedInferenceLimitError
      && error.status === 429
      && error.retryAfterSeconds >= 1
    ));

    await lease.release({ inputTokens: 5, outputTokens: 5 });
    await lease.release({ inputTokens: 99, outputTokens: 99 });
    const next = await limiter.acquire({
      userId: 'user-1', estimatedInputTokens: 10, requestedOutputTokens: 20,
    });
    await next.release();
  });

  it('enforces request and adjusted token budgets within an isolated user window', async () => {
    let now = 1_000;
    const limiter = createInMemoryManagedInferenceLimiter({
      ...policy, maxRequestsPerWindow: 3, maxTokensPerWindow: 50,
    }, { now: () => now });
    const first = await limiter.acquire({
      userId: 'user-1', estimatedInputTokens: 20, requestedOutputTokens: 20,
    });
    await first.release({ inputTokens: 10, outputTokens: 10 });
    const second = await limiter.acquire({
      userId: 'user-1', estimatedInputTokens: 10, requestedOutputTokens: 20,
    });
    await second.release();

    await assert.rejects(() => limiter.acquire({
      userId: 'user-1', estimatedInputTokens: 1, requestedOutputTokens: 1,
    }), (error: unknown) => (
      error instanceof ManagedInferenceLimitError && error.retryAfterSeconds === 60
    ));
    const otherUser = await limiter.acquire({
      userId: 'user-2', estimatedInputTokens: 1, requestedOutputTokens: 1,
    });
    await otherUser.release();

    now += 60_000;
    const reset = await limiter.acquire({
      userId: 'user-1', estimatedInputTokens: 1, requestedOutputTokens: 1,
    });
    await reset.release();
  });
});
