import type {
  NormalizedInferenceErrorCode,
  ProviderProtocol,
} from '../../../../packages/ai-control-plane-contracts/src';
import { anthropicMessagesAdapter } from './anthropicMessages';
import { geminiGenerateContentAdapter } from './geminiGenerateContent';
import { openAiChatCompletionsAdapter } from './openAiChatCompletions';
import { openAiResponsesAdapter } from './openAiResponses';
import { requestSafeProviderStream } from './safeProviderTransport';
import type { ExecuteProviderInferenceInput, ProviderAdapter } from './types';

export type {
  ExecuteProviderInferenceInput,
  ProviderAdapter,
  ProviderInferenceLimits,
  ProviderTarget,
} from './types';

export const PROTOCOL_ADAPTERS: Readonly<Record<ProviderProtocol, ProviderAdapter>> = {
  'openai-chat-completions': openAiChatCompletionsAdapter,
  'openai-responses': openAiResponsesAdapter,
  'anthropic-messages': anthropicMessagesAdapter,
  'gemini-generate-content': geminiGenerateContentAdapter,
};

export class ProviderAdapterError extends Error {
  constructor(
    public readonly code: NormalizedInferenceErrorCode,
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super('Upstream provider request failed.');
    this.name = 'ProviderAdapterError';
  }
}

const statusError = (status: number): ProviderAdapterError => {
  if (status === 401) return new ProviderAdapterError('unauthorized', false, status);
  if (status === 403) return new ProviderAdapterError('forbidden', false, status);
  if (status === 400 || status === 422) return new ProviderAdapterError('invalid_request', false, status);
  if (status === 404 || status === 409) return new ProviderAdapterError('model_unavailable', false, status);
  if (status === 408 || status === 504) return new ProviderAdapterError('upstream_timeout', true, status);
  if (status === 429) return new ProviderAdapterError('rate_limited', true, status);
  return new ProviderAdapterError('upstream_error', status >= 500, status);
};

const boundedInteger = (value: number | undefined, fallback: number, maximum: number): number =>
  Math.max(1, Math.min(value ?? fallback, maximum));

const withByteLimit = (response: Response, maximumBytes: number): Response => {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new ProviderAdapterError('upstream_error', false);
  }
  if (!response.body) return response;
  const reader = response.body.getReader();
  let received = 0;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await reader.read();
        if (chunk.done) {
          controller.close();
          return;
        }
        received += chunk.value.byteLength;
        if (received > maximumBytes) {
          await reader.cancel();
          controller.error(new ProviderAdapterError('upstream_error', false));
          return;
        }
        controller.enqueue(chunk.value);
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
    },
  });
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};

const safeRequest = async (
  url: string,
  init: RequestInit,
  maximumBytes: number,
  signal: AbortSignal,
): Promise<Response> => {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  return requestSafeProviderStream({
    url,
    method: init.method ?? 'POST',
    headers: Object.fromEntries(new Headers(init.headers).entries()),
    body: new TextEncoder().encode(typeof init.body === 'string' ? init.body : ''),
    signal,
    maxResponseBytes: maximumBytes,
  });
};

export async function* executeProviderInference(
  input: ExecuteProviderInferenceInput,
) {
  const adapter = PROTOCOL_ADAPTERS[input.provider.protocol];
  const wire = adapter.buildRequest(input);
  const timeoutMs = boundedInteger(input.limits?.timeoutMs, 60_000, 120_000);
  const maximumBytes = boundedInteger(input.limits?.maxResponseBytes, 8 * 1024 * 1024, 8 * 1024 * 1024);
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onCallerAbort = (): void => controller.abort();
  if (input.signal?.aborted) controller.abort();
  else input.signal?.addEventListener('abort', onCallerAbort, { once: true });
  const init: RequestInit = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(input.request.stream ? { accept: 'text/event-stream' } : {}),
      ...wire.headers,
    },
    body: JSON.stringify(wire.body),
    signal: controller.signal,
  };
  try {
    const fetched = input.fetchFn
      ? await input.fetchFn(wire.url, init)
      : await safeRequest(wire.url, init, maximumBytes, controller.signal);
    if (!fetched.ok) throw statusError(fetched.status);
    const response = withByteLimit(fetched, maximumBytes);
    if (input.request.stream) {
      yield* adapter.parseStream(response);
      return;
    }
    const text = await response.text();
    let value: unknown;
    try {
      value = JSON.parse(text) as unknown;
    } catch {
      throw new ProviderAdapterError('upstream_error', false);
    }
    yield* adapter.parseNonStream(value);
  } catch (error) {
    if (error instanceof ProviderAdapterError) throw error;
    if (controller.signal.aborted) {
      throw timedOut
        ? new ProviderAdapterError('upstream_timeout', true)
        : new ProviderAdapterError('aborted', false);
    }
    throw new ProviderAdapterError('upstream_error', true);
  } finally {
    clearTimeout(timeout);
    input.signal?.removeEventListener('abort', onCallerAbort);
  }
}
