import type {
  NormalizedInferenceError,
  NormalizedInferenceEvent,
  NormalizedInferenceRequest,
  ModelCapabilities,
  ProviderProtocol,
} from '../../../packages/ai-control-plane-contracts/src';
import {
  executeWithSameRouteRetry,
  RetryDeadlineExceededError,
  RetryExecutionError,
} from '../control/sameRouteRetry';
import {
  decryptSecret,
  type MasterKeyProvider,
} from '../security/envelopeEncryption';
import type { ManagedInferenceRepository } from './managedInferenceTypes';
import {
  createInMemoryManagedInferenceLimiter,
  DEFAULT_MANAGED_INFERENCE_LIMIT_POLICY,
  type ManagedInferenceLimiter,
  type ManagedInferenceLimitLease,
} from './managedInferenceLimiter';

export interface ProviderInferenceInput {
  provider: { protocol: ProviderProtocol; baseUrl: string };
  modelId: string;
  secret: string;
  request: NormalizedInferenceRequest;
  signal?: AbortSignal;
  limits?: { timeoutMs?: number; maxResponseBytes?: number };
}

export type ExecuteProviderInference = (
  input: ProviderInferenceInput,
) => AsyncIterable<NormalizedInferenceEvent>;

export interface ManagedInferenceServiceDependencies {
  repository: ManagedInferenceRepository;
  masterKeys: MasterKeyProvider;
  execute: ExecuteProviderInference;
  decryptCredential?: typeof decryptSecret;
  now?: () => number;
  limiter?: ManagedInferenceLimiter;
}

function normalizedError(error: unknown, aborted: boolean): NormalizedInferenceError {
  if (aborted || (error instanceof Error && error.name === 'AbortError')) {
    return { code: 'aborted', message: 'Inference was cancelled.', retryable: false };
  }
  if (error instanceof RetryDeadlineExceededError) {
    return { code: 'upstream_timeout', message: 'The model timed out.', retryable: true, status: 504 };
  }
  if (error instanceof RetryExecutionError) {
    if (error.status === 429) {
      return { code: 'rate_limited', message: 'The model is temporarily rate limited.', retryable: true, status: 429 };
    }
    if (error.status === 408 || error.status === 504 || error.code === 'ETIMEDOUT') {
      return { code: 'upstream_timeout', message: 'The model timed out.', retryable: true, status: 504 };
    }
    if (error.status === 400 || error.status === 422) {
      return { code: 'invalid_request', message: 'The model rejected the request.', retryable: false, status: 400 };
    }
    return {
      code: 'upstream_error',
      message: 'The model request failed.',
      retryable: error.status === undefined || error.status >= 500,
      ...(error.status ? { status: error.status } : {}),
    };
  }
  if (typeof error === 'object' && error !== null) {
    const value = error as { code?: unknown; retryable?: unknown; status?: unknown };
    const code = value.code;
    const retryable = value.retryable === true;
    const status = typeof value.status === 'number' ? value.status : undefined;
    if (code === 'rate_limited') {
      return { code, message: 'The model is temporarily rate limited.', retryable, status: 429 };
    }
    if (code === 'upstream_timeout') {
      return { code, message: 'The model timed out.', retryable, status: 504 };
    }
    if (code === 'invalid_request') {
      return { code, message: 'The model rejected the request.', retryable: false, status: 400 };
    }
    if (code === 'model_unavailable') {
      return { code, message: 'The selected model is unavailable.', retryable: false, status: 503 };
    }
    if (code === 'aborted') {
      return { code, message: 'Inference was cancelled.', retryable: false };
    }
    if (code === 'upstream_error' || code === 'unauthorized' || code === 'forbidden') {
      return {
        code: 'upstream_error',
        message: 'The model request failed.',
        retryable,
        ...(status && status >= 500 ? { status } : {}),
      };
    }
  }
  return { code: 'upstream_error', message: 'The model request failed.', retryable: false };
}

function errorEvents(error: NormalizedInferenceError): NormalizedInferenceEvent[] {
  return [
    { type: 'error', error },
    { type: 'completion', reason: error.code === 'aborted' ? 'cancelled' : 'error' },
  ];
}

function supportsRequest(
  capabilities: ModelCapabilities,
  request: NormalizedInferenceRequest,
): boolean {
  if (request.stream && !capabilities.streaming) return false;
  if ((request.tools?.length ?? 0) > 0 && !capabilities.tools) return false;
  const hasImage = request.messages.some((message) => (
    Array.isArray(message.content) && message.content.some((part) => part.type === 'image')
  ));
  if (hasImage && !capabilities.vision) return false;
  if (request.responseFormat?.type === 'json_object' && !capabilities.jsonObject) return false;
  if (request.responseFormat?.type === 'json_schema' && !capabilities.jsonSchema) return false;
  return true;
}

export function createManagedInferenceService(deps: ManagedInferenceServiceDependencies) {
  const decryptCredential = deps.decryptCredential ?? decryptSecret;
  const now = deps.now ?? Date.now;
  const limiter = deps.limiter ?? createInMemoryManagedInferenceLimiter(
    DEFAULT_MANAGED_INFERENCE_LIMIT_POLICY,
    { now },
  );

  return {
    async *execute(
      userId: string,
      request: NormalizedInferenceRequest,
      signal?: AbortSignal,
    ): AsyncGenerator<NormalizedInferenceEvent> {
      const startedAt = now();
      let inputTokens: number | undefined;
      let outputTokens: number | undefined;
      const estimatedInputTokens = Math.max(
        1,
        Buffer.byteLength(JSON.stringify(request), 'utf8'),
      );
      const userLease = await limiter.acquireUser({
        userId,
        // One token per UTF-8 byte is a provider-independent, conservative pre-route estimate.
        estimatedInputTokens,
        requestedOutputTokens: request.maxOutputTokens,
      });
      let routeLease: ManagedInferenceLimitLease | undefined;
      try {
        const binding = await deps.repository.resolveRoute(userId, request.purpose);
        if (!binding) {
          yield* errorEvents({
            code: 'model_unavailable',
            message: request.purpose === 'flash'
              ? 'The managed extraction model is unavailable.'
              : 'Select an available managed model before chatting.',
            retryable: false,
            status: 503,
          });
          return;
        }
        routeLease = await limiter.acquireRoute({
          routeId: binding.routeId,
          estimatedInputTokens,
          requestedOutputTokens: request.maxOutputTokens,
        });
        let status: 'succeeded' | 'failed' | 'cancelled' = 'succeeded';
        let errorCode: NormalizedInferenceError['code'] | undefined;
        let sawCompletion = false;
        try {
          const inputBytes = Buffer.byteLength(JSON.stringify(request), 'utf8');
          if (
            inputBytes > binding.maxInputBytes
            || (request.maxOutputTokens !== undefined
              && request.maxOutputTokens > binding.maxOutputTokens)
            || !supportsRequest(binding.capabilities, request)
          ) {
            status = 'failed';
            errorCode = 'invalid_request';
            yield* errorEvents({
              code: 'invalid_request',
              message: 'The inference request exceeds the configured route limits.',
              retryable: false,
              status: 400,
            });
            return;
          }
          if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
          const secret = await decryptCredential(
            binding.credential,
            deps.masterKeys,
            `provider:${binding.providerId}`,
          );
          const boundedRequest: NormalizedInferenceRequest = {
            ...request,
            maxOutputTokens: request.maxOutputTokens ?? binding.maxOutputTokens,
          };
          const established = await executeWithSameRouteRetry({
            binding: { routeId: binding.routeId, modelId: binding.modelId },
            policy: {
              maxAttempts: 2,
              baseDelayMs: 50,
              maxTotalMs: binding.requestTimeoutMs,
            },
            execute: async (_fixed, _attempt, retrySignal) => {
              const executionSignal = signal
                ? AbortSignal.any([signal, retrySignal])
                : retrySignal;
              const iterator = deps.execute({
                provider: { protocol: binding.protocol, baseUrl: binding.baseUrl },
                modelId: binding.modelId,
                secret,
                request: boundedRequest,
                signal: executionSignal,
                limits: {
                  timeoutMs: binding.requestTimeoutMs,
                  maxResponseBytes: Math.min(
                    8 * 1024 * 1024,
                    64 * 1024 + (binding.maxOutputTokens * 16),
                  ),
                },
              })[Symbol.asyncIterator]();
              return { iterator, first: await iterator.next() };
            },
          });
          let next = established.first;
          while (!next.done) {
            const event = next.value;
            if (event.type === 'usage') {
              inputTokens = event.inputTokens;
              outputTokens = event.outputTokens;
            } else if (event.type === 'error') {
              status = event.error.code === 'aborted' ? 'cancelled' : 'failed';
              errorCode = event.error.code;
            } else if (event.type === 'completion') {
              sawCompletion = true;
              if (event.reason === 'cancelled') status = 'cancelled';
              else if (event.reason === 'error') status = 'failed';
            }
            yield event;
            next = await established.iterator.next();
          }
          if (!sawCompletion) yield { type: 'completion', reason: 'stop' };
        } catch (error) {
          const normalized = normalizedError(error, signal?.aborted ?? false);
          status = normalized.code === 'aborted' ? 'cancelled' : 'failed';
          errorCode = normalized.code;
          yield* errorEvents(normalized);
        } finally {
          await deps.repository.appendUsage({
            userId,
            routeId: binding.routeId,
            status,
            ...(inputTokens === undefined ? {} : { inputTokens }),
            ...(outputTokens === undefined ? {} : { outputTokens }),
            latencyMs: Math.max(0, now() - startedAt),
            ...(errorCode ? { errorCode } : {}),
          }).catch(() => undefined);
        }
      } finally {
        const usage = inputTokens === undefined && outputTokens === undefined
          ? undefined
          : { inputTokens, outputTokens };
        if (routeLease) {
          await Promise.resolve(routeLease.release(usage)).catch(() => undefined);
        }
        await Promise.resolve(userLease.release(usage)).catch(() => undefined);
      }
    },
  };
}

export type ManagedInferenceService = ReturnType<typeof createManagedInferenceService>;
