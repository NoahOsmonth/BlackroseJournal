export interface RouteBinding {
  readonly routeId: string;
  readonly modelId: string;
}

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxTotalMs: number;
}

export class RetryExecutionError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'RetryExecutionError';
    this.status = status;
    this.code = code;
  }
}

export class RetryDeadlineExceededError extends Error {
  constructor() {
    super('Managed retry deadline exceeded.');
    this.name = 'RetryDeadlineExceededError';
  }
}

export interface SameRouteRetryOptions<T> {
  binding: RouteBinding;
  policy: RetryPolicy;
  execute(binding: RouteBinding, attempt: number, signal: AbortSignal): Promise<T>;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
}

const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const TRANSIENT_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT']);

function isTransient(error: unknown): boolean {
  if (error instanceof RetryExecutionError) {
    return (error.status !== undefined && TRANSIENT_STATUSES.has(error.status))
      || (error.code !== undefined && TRANSIENT_CODES.has(error.code));
  }
  if (typeof error !== 'object' || error === null) return false;
  const value = error as { status?: unknown; code?: unknown; retryable?: unknown };
  if (typeof value.retryable === 'boolean') return value.retryable;
  return (typeof value.status === 'number' && TRANSIENT_STATUSES.has(value.status))
    || (typeof value.code === 'string' && TRANSIENT_CODES.has(value.code));
}

const defaultSleep = (milliseconds: number): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});

export async function executeWithSameRouteRetry<T>(
  options: SameRouteRetryOptions<T>,
): Promise<T> {
  if (!options.binding.routeId || !options.binding.modelId) {
    throw new Error('A fixed route and model binding is required.');
  }
  const maxAttempts = Math.max(1, Math.min(Math.floor(options.policy.maxAttempts), 3));
  const baseDelayMs = Math.max(0, Math.min(Math.floor(options.policy.baseDelayMs), 10_000));
  const maxTotalMs = Math.max(1, Math.min(Math.floor(options.policy.maxTotalMs), 120_000));
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const startedAt = now();
  const binding = Object.freeze({ ...options.binding });

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const remaining = maxTotalMs - (now() - startedAt);
      if (remaining <= 0) throw new RetryDeadlineExceededError();
      const controller = new AbortController();
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new RetryDeadlineExceededError());
        }, remaining);
      });
      try {
        return await Promise.race([
          options.execute(binding, attempt, controller.signal),
          deadline,
        ]);
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    } catch (error) {
      if (!isTransient(error) || attempt === maxAttempts) throw error;
      const elapsed = now() - startedAt;
      const remaining = maxTotalMs - elapsed;
      const delay = Math.min(baseDelayMs * (2 ** (attempt - 1)), remaining);
      if (delay <= 0) throw error;
      await sleep(delay);
      if (now() - startedAt >= maxTotalMs) throw error;
    }
  }
  throw new Error('Retry execution exhausted.');
}
