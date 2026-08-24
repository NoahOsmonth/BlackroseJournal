export interface ManagedInferenceLimitPolicy {
  readonly maxConcurrentPerUser: number;
  readonly maxRequestsPerWindow: number;
  readonly maxTokensPerWindow: number;
  readonly windowMs: number;
  readonly defaultOutputTokenReservation: number;
}

export const DEFAULT_MANAGED_INFERENCE_LIMIT_POLICY: ManagedInferenceLimitPolicy = Object.freeze({
  maxConcurrentPerUser: 2,
  maxRequestsPerWindow: 30,
  maxTokensPerWindow: 100_000,
  windowMs: 60_000,
  defaultOutputTokenReservation: 2_048,
});

export interface ManagedInferenceLimitInput {
  userId: string;
  estimatedInputTokens: number;
  requestedOutputTokens?: number;
}

export interface ManagedInferenceLimitUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface ManagedInferenceLimitLease {
  release(usage?: ManagedInferenceLimitUsage): Promise<void> | void;
}

/**
 * Inject this boundary ahead of route lookup and credential decryption.
 * The bundled implementation is process-local and is safe only for one backend instance.
 * Multi-instance deployments must inject a distributed, atomic implementation backed by a
 * shared store; multiplying the local limits per replica is not an acceptable substitute.
 */
export interface ManagedInferenceLimiter {
  acquire(input: ManagedInferenceLimitInput): Promise<ManagedInferenceLimitLease>;
}

export class ManagedInferenceLimitError extends Error {
  readonly status = 429;
  readonly code = 'rate_limited';

  constructor(public readonly retryAfterSeconds: number) {
    super('Managed inference quota exceeded.');
    this.name = 'ManagedInferenceLimitError';
  }
}

interface UserLimitState {
  windowStartedAt: number;
  requests: number;
  tokens: number;
  concurrent: number;
}

const positiveInteger = (value: number): number => Math.max(1, Math.floor(value));

export function createInMemoryManagedInferenceLimiter(
  policy: ManagedInferenceLimitPolicy,
  dependencies: { now?: () => number } = {},
): ManagedInferenceLimiter {
  const now = dependencies.now ?? Date.now;
  const states = new Map<string, UserLimitState>();

  return {
    async acquire(input) {
      const currentTime = now();
      const state = states.get(input.userId) ?? {
        windowStartedAt: currentTime,
        requests: 0,
        tokens: 0,
        concurrent: 0,
      };
      if (currentTime - state.windowStartedAt >= policy.windowMs) {
        state.windowStartedAt = currentTime;
        state.requests = 0;
        state.tokens = 0;
      }
      states.set(input.userId, state);
      if (state.concurrent >= policy.maxConcurrentPerUser) {
        throw new ManagedInferenceLimitError(1);
      }
      const reservedTokens = positiveInteger(input.estimatedInputTokens)
        + positiveInteger(input.requestedOutputTokens ?? policy.defaultOutputTokenReservation);
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((state.windowStartedAt + policy.windowMs - currentTime) / 1000),
      );
      if (
        state.requests >= policy.maxRequestsPerWindow
        || state.tokens + reservedTokens > policy.maxTokensPerWindow
      ) {
        throw new ManagedInferenceLimitError(retryAfterSeconds);
      }
      state.requests += 1;
      state.tokens += reservedTokens;
      state.concurrent += 1;
      const leaseWindow = state.windowStartedAt;
      let released = false;
      return {
        release(usage) {
          if (released) return;
          released = true;
          state.concurrent = Math.max(0, state.concurrent - 1);
          if (usage && state.windowStartedAt === leaseWindow) {
            const actualTokens = Math.max(0, Math.floor(usage.inputTokens ?? 0))
              + Math.max(0, Math.floor(usage.outputTokens ?? 0));
            state.tokens = Math.max(0, state.tokens - reservedTokens + actualTokens);
          }
        },
      };
    },
  };
}
