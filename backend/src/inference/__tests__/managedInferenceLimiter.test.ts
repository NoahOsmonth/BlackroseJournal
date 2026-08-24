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
  maxConcurrentPerRoute: 1,
  maxRequestsPerRouteWindow: 3,
  maxTokensPerRouteWindow: 150,
  windowMs: 60_000,
  defaultOutputTokenReservation: 20,
};

describe('in-memory managed inference limiter', () => {
  it('enforces per-user concurrency and releases a lease exactly once', async () => {
    const limiter = createInMemoryManagedInferenceLimiter(policy);
    const lease = await limiter.acquireUser({
      userId: 'user-1', estimatedInputTokens: 10, requestedOutputTokens: 20,
    });

    await assert.rejects(() => limiter.acquireUser({
      userId: 'user-1', estimatedInputTokens: 1, requestedOutputTokens: 1,
    }), (error: unknown) => (
      error instanceof ManagedInferenceLimitError
      && error.status === 429
      && error.retryAfterSeconds >= 1
    ));

    await lease.release({ inputTokens: 5, outputTokens: 5 });
    await lease.release({ inputTokens: 99, outputTokens: 99 });
    const next = await limiter.acquireUser({
      userId: 'user-1', estimatedInputTokens: 10, requestedOutputTokens: 20,
    });
    await next.release();
  });

  it('enforces request and adjusted token budgets within an isolated user window', async () => {
    let now = 1_000;
    const limiter = createInMemoryManagedInferenceLimiter({
      ...policy, maxRequestsPerWindow: 3, maxTokensPerWindow: 50,
    }, { now: () => now });
    const first = await limiter.acquireUser({
      userId: 'user-1', estimatedInputTokens: 20, requestedOutputTokens: 20,
    });
    await first.release({ inputTokens: 10, outputTokens: 10 });
    const second = await limiter.acquireUser({
      userId: 'user-1', estimatedInputTokens: 10, requestedOutputTokens: 20,
    });
    await second.release();

    await assert.rejects(() => limiter.acquireUser({
      userId: 'user-1', estimatedInputTokens: 1, requestedOutputTokens: 1,
    }), (error: unknown) => (
      error instanceof ManagedInferenceLimitError && error.retryAfterSeconds === 60
    ));
    const otherUser = await limiter.acquireUser({
      userId: 'user-2', estimatedInputTokens: 1, requestedOutputTokens: 1,
    });
    await otherUser.release();

    now += 60_000;
    const reset = await limiter.acquireUser({
      userId: 'user-1', estimatedInputTokens: 1, requestedOutputTokens: 1,
    });
    await reset.release();
  });

  it('shares route concurrency and budgets across different users on the same route', async () => {
    const limiter = createInMemoryManagedInferenceLimiter(policy);
    const first = await limiter.acquireRoute({
      routeId: 'route-shared', estimatedInputTokens: 10, requestedOutputTokens: 10,
    });

    await assert.rejects(() => limiter.acquireRoute({
      routeId: 'route-shared', estimatedInputTokens: 10, requestedOutputTokens: 10,
    }), ManagedInferenceLimitError);
    const otherRoute = await limiter.acquireRoute({
      routeId: 'route-other', estimatedInputTokens: 10, requestedOutputTokens: 10,
    });
    await otherRoute.release();
    await first.release();
  });

  it('allows one user to hold distinct-route leases within the user concurrency ceiling', async () => {
    const limiter = createInMemoryManagedInferenceLimiter({
      ...policy, maxConcurrentPerUser: 2,
    });
    const firstUser = await limiter.acquireUser({
      userId: 'user-1', estimatedInputTokens: 1, requestedOutputTokens: 1,
    });
    const secondUser = await limiter.acquireUser({
      userId: 'user-1', estimatedInputTokens: 1, requestedOutputTokens: 1,
    });
    const firstRoute = await limiter.acquireRoute({
      routeId: 'route-a', estimatedInputTokens: 1, requestedOutputTokens: 1,
    });
    const secondRoute = await limiter.acquireRoute({
      routeId: 'route-b', estimatedInputTokens: 1, requestedOutputTokens: 1,
    });

    await Promise.all([
      firstRoute.release(), secondRoute.release(), firstUser.release(), secondUser.release(),
    ]);
  });
});
