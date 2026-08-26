export interface ManagedInferenceLimitPolicy {
  readonly maxConcurrentPerUser: number;
  readonly maxRequestsPerWindow: number;
  readonly maxTokensPerWindow: number;
  readonly maxConcurrentPerRoute: number;
  readonly maxRequestsPerRouteWindow: number;
  readonly maxTokensPerRouteWindow: number;
  readonly windowMs: number;
  readonly defaultOutputTokenReservation: number;
}

export const DEFAULT_MANAGED_INFERENCE_LIMIT_POLICY: ManagedInferenceLimitPolicy = Object.freeze({
  maxConcurrentPerUser: 2,
  maxRequestsPerWindow: 30,
  maxTokensPerWindow: 100_000,
  maxConcurrentPerRoute: 8,
  maxRequestsPerRouteWindow: 120,
  maxTokensPerRouteWindow: 400_000,
  windowMs: 60_000,
  defaultOutputTokenReservation: 2_048,
});

export interface ManagedInferenceLimitInput {
  estimatedInputTokens: number;
  requestedOutputTokens?: number;
}

export interface ManagedInferenceUserLimitInput extends ManagedInferenceLimitInput {
  userId: string;
}

export interface ManagedInferenceRouteLimitInput extends ManagedInferenceLimitInput {
  routeId: string;
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
  acquireUser(input: ManagedInferenceUserLimitInput): Promise<ManagedInferenceLimitLease>;
  acquireRoute(input: ManagedInferenceRouteLimitInput): Promise<ManagedInferenceLimitLease>;
}

export class ManagedInferenceLimitError extends Error {
  readonly status = 429;
  readonly code = 'rate_limited';

  constructor(public readonly retryAfterSeconds: number) {
    super('Managed inference quota exceeded.');
    this.name = 'ManagedInferenceLimitError';
  }
}

interface LimitState {
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
  const userStates = new Map<string, LimitState>();
  const routeStates = new Map<string, LimitState>();

  const acquire = async (
    states: Map<string, LimitState>,
    key: string,
    input: ManagedInferenceLimitInput,
    ceilings: { concurrent: number; requests: number; tokens: number },
  ): Promise<ManagedInferenceLimitLease> => {
    const currentTime = now();
    const state = states.get(key) ?? {
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
    states.set(key, state);
    if (state.concurrent >= ceilings.concurrent) {
      throw new ManagedInferenceLimitError(1);
    }
    const reservedTokens = positiveInteger(input.estimatedInputTokens)
      + positiveInteger(input.requestedOutputTokens ?? policy.defaultOutputTokenReservation);
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((state.windowStartedAt + policy.windowMs - currentTime) / 1000),
    );
    if (state.requests >= ceilings.requests || state.tokens + reservedTokens > ceilings.tokens) {
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
  };

  return {
    acquireUser: (input) => acquire(userStates, input.userId, input, {
      concurrent: policy.maxConcurrentPerUser,
      requests: policy.maxRequestsPerWindow,
      tokens: policy.maxTokensPerWindow,
    }),
    acquireRoute: (input) => acquire(routeStates, input.routeId, input, {
      concurrent: policy.maxConcurrentPerRoute,
      requests: policy.maxRequestsPerRouteWindow,
      tokens: policy.maxTokensPerRouteWindow,
    }),
  };
}
