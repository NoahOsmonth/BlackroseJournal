/**
 * Direct-to-provider transport (OpenAI-compatible `/chat/completions`).
 *
 * Targets the phone → provider path. The request body is filtered to
 * OpenAI-standard fields. Transient failures self-heal with up to 3 attempts
 * and exponential backoff; missing/unavailable models cascade to a higher-
 * parameter alternate from the user's cache + curated free fallbacks.
 */

import {
    buildModelFallbackQueue,
    isModelNotFoundError,
} from '@/utils/ai/modelFallback';
import { loadCustomAiProviderSettings } from './customModels';
import { getResolvedDirectConfig, type ResolvedDirectConfig } from './directConfig';
import {
    acquireAccountOperationLease,
    type AccountOperationLease,
} from '@/services/account/accountRuntime';
import { getProviderCapabilities, type ProviderCapabilities } from './providerCapabilities';

export interface DirectChatRequest {
    model: string;
    /** OpenAI-style messages; content may be null for tool-call assistant turns. */
    messages: { role: string; content: string | null; tool_calls?: unknown; tool_call_id?: string; name?: string }[];
    stream?: boolean;
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    max_completion_tokens?: number;
    response_format?: { type: 'json_object' };
    tools?: unknown[];
    tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
    /** OpenAI stream usage on final chunk. */
    stream_options?: { include_usage?: boolean };
}

export interface DirectChatOptions {
    /** Override the model resolved by getDirectConfig. */
    model?: string;
    /** Use the lower-latency model when the active provider exposes one. */
    modelPurpose?: 'default' | 'flash';
    /** Extra headers to merge on top of the defaults. */
    headers?: Record<string, string>;
    /** Optional AbortSignal forwarded to fetch. */
    signal?: AbortSignal;
}

export interface PreparedDirectChatRequest {
    url: string;
    headers: Record<string, string>;
    body: DirectChatRequest;
    configSource: ResolvedDirectConfig['source'];
    capabilities: ProviderCapabilities;
}

/** Same-model retries for transient network / gateway errors. */
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 250;
/** Cap how many alternate models we try after the primary is missing. */
const MAX_MODEL_FALLBACKS = 3;

// ---------------------------------------------------------------------------
// Model-unavailability TTL cache (Fix 1): skip known-dead models on repeat
// requests instead of re-discovering the 404 every turn.
// ---------------------------------------------------------------------------
const UNAVAILABLE_TTL_MS = 5 * 60 * 1000;
const modelUnavailableCache = new Map<string, number>(); // modelId -> expiry ts

function isCachedUnavailable(model: string): boolean {
    const expiry = modelUnavailableCache.get(model);
    if (!expiry) return false;
    if (Date.now() > expiry) {
        modelUnavailableCache.delete(model);
        return false;
    }
    return true;
}

function cacheUnavailable(model: string): void {
    modelUnavailableCache.set(model, Date.now() + UNAVAILABLE_TTL_MS);
}

/** Public: check whether a model id is currently cached as unavailable. */
export function isModelCachedUnavailable(model: string | undefined | null): boolean {
    if (!model || model === 'agent-default') return false;
    return isCachedUnavailable(model);
}

/** Clear the unavailability cache (tests, settings change). */
export function clearModelUnavailableCache(): void {
    modelUnavailableCache.clear();
}

// ---------------------------------------------------------------------------
// Last resolved model (Fix 2): let the UI reflect self-heal model switches.
// ---------------------------------------------------------------------------
let lastResolvedModel: string | null = null;

/** The model that actually served the most recent successful request. */
export function getLastResolvedModel(): string | null {
    return lastResolvedModel;
}

function buildUrl(apiBaseUrl: string): string {
    const base = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
    return `${base}/chat/completions`;
}

function resolveDefaultModel(config: ResolvedDirectConfig, purpose: DirectChatOptions['modelPurpose']): string {
    return purpose === 'flash' ? config.flashModel : config.model;
}

function resolveModel(
    payloadModel: string | undefined,
    config: ResolvedDirectConfig,
    purpose: DirectChatOptions['modelPurpose']
): string {
    const defaultModel = resolveDefaultModel(config, purpose);
    if (config.source === 'custom') return defaultModel;
    if (!payloadModel || payloadModel === 'agent-default') return defaultModel;
    return payloadModel;
}

const ACCOUNT_SWITCH_ERROR_MESSAGE = 'AI request was cancelled by an account switch.';

function accountSwitchCancellationError(): Error {
    const error = new Error(ACCOUNT_SWITCH_ERROR_MESSAGE);
    error.name = 'AbortError';
    return error;
}

function throwIfAccountLeaseAborted(lease: Pick<AccountOperationLease, 'signal'>): void {
    if (lease.signal.aborted) throw accountSwitchCancellationError();
}

function createAbortError(): Error {
    const error = new Error('The operation was aborted.');
    error.name = 'AbortError';
    return error;
}

function composeAbortSignals(
    accountSignal: AbortSignal,
    callerSignal?: AbortSignal,
): { signal: AbortSignal; cleanup(): void } {
    if (!callerSignal) return { signal: accountSignal, cleanup: () => undefined };
    const controller = new AbortController();
    const abortFromSignal = (signal: AbortSignal) => {
        if (!controller.signal.aborted) controller.abort(signal.reason);
    };
    const onAbort = (event: Event) => abortFromSignal(event.target as AbortSignal);
    [accountSignal, callerSignal].forEach((signal) => {
        if (signal.aborted) abortFromSignal(signal);
        else signal.addEventListener('abort', onAbort, { once: true });
    });
    return {
        signal: controller.signal,
        cleanup: () => {
            accountSignal.removeEventListener('abort', onAbort);
            callerSignal.removeEventListener('abort', onAbort);
        },
    };
}

function buildConnectionError(request: PreparedDirectChatRequest, source: ResolvedDirectConfig['source']): Error {
    const provider = source === 'custom' ? 'custom AI provider' : 'AI provider';
    const setting = source === 'custom'
        ? 'the AI Model Base URL in Settings'
        : 'EXPO_PUBLIC_NANO_GPT_API_BASE_URL (OpenRouter recommended)';
    return new Error(
        `Failed to fetch: Could not connect to ${provider} at ${request.url}. ` +
        `Check your network and ${setting}.`
    );
}

function buildPreparedDirectChatRequest(
    payload: DirectChatRequest,
    options: DirectChatOptions,
    config: ResolvedDirectConfig,
): PreparedDirectChatRequest {
    const capabilities = getProviderCapabilities(config.apiBaseUrl);
    const url = buildUrl(config.apiBaseUrl);
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: payload.stream ? 'text/event-stream' : 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        ...capabilities.extraHeaders,
        ...(options.headers ?? {}),
    };
    const body: DirectChatRequest = {
        model: options.model ?? resolveModel(payload.model, config, options.modelPurpose),
        messages: payload.messages,
        stream: payload.stream,
        temperature: payload.temperature,
        top_p: payload.top_p,
        response_format: capabilities.supportsResponseFormat ? payload.response_format : undefined,
    };
    if (payload.max_tokens !== undefined) {
        body[capabilities.maxTokensField] = payload.max_tokens;
    }
    if (payload.tools && payload.tools.length > 0) {
        body.tools = payload.tools;
        body.tool_choice = payload.tool_choice ?? 'auto';
    }
    if (payload.stream && payload.stream_options) {
        body.stream_options = payload.stream_options;
    }

    return { url, headers, body, configSource: config.source, capabilities };
}

export async function prepareDirectChatRequest(
    payload: DirectChatRequest,
    options: DirectChatOptions = {}
): Promise<PreparedDirectChatRequest> {
    const lease = acquireAccountOperationLease('byok-inference-preparation');
    try {
        const config = await getResolvedDirectConfig(lease.signal);
        throwIfAccountLeaseAborted(lease);
        return buildPreparedDirectChatRequest(payload, options, config);
    } catch (error) {
        if (lease.signal.aborted) throw accountSwitchCancellationError();
        throw error;
    } finally {
        lease.release();
    }
}

function backoffMs(attempt: number): number {
    const base = BASE_BACKOFF_MS * Math.pow(2, attempt);
    const variance = base * 0.2;
    return Math.round(base + (Math.random() * 2 - 1) * variance);
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function delayUnlessAccountSwitched(ms: number, accountSignal: AbortSignal): Promise<void> {
    await delay(ms);
    throwIfAccountLeaseAborted({ signal: accountSignal });
}

function isAbortError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const name = (err as { name?: string }).name;
    return name === 'AbortError' || name === 'TimeoutError';
}

async function peekResponseText(response: Response): Promise<string> {
    try {
        return await response.clone().text();
    } catch {
        return '';
    }
}

/**
 * Resolve alternate models (higher params preferred) from local settings +
 * builtins. Failures load as an empty list — never block the primary error.
 */
interface RetainedStreamingResponse {
    readonly response: Response;
    readonly ownsLease: boolean;
}

function cancellationError(
    accountSignal: AbortSignal,
    callerSignal?: AbortSignal,
): Error {
    if (accountSignal.aborted) return accountSwitchCancellationError();
    if (callerSignal?.reason instanceof Error) return callerSignal.reason;
    const error = new Error('The operation was aborted.');
    error.name = 'AbortError';
    return error;
}

function retainLeaseForStreamingResponse(
    response: Response,
    lease: AccountOperationLease,
    composed: { signal: AbortSignal; cleanup(): void },
    callerSignal?: AbortSignal,
): RetainedStreamingResponse {
    if (!response.body || typeof globalThis.ReadableStream !== 'function') {
        return { response, ownsLease: false };
    }

    const reader = response.body.getReader();
    let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
    let terminated = false;
    let finalized = false;
    const finalize = () => {
        if (finalized) return;
        finalized = true;
        composed.cleanup();
        lease.release();
    };
    const onAbort = () => {
        if (terminated) return;
        terminated = true;
        const error = cancellationError(lease.signal, callerSignal);
        streamController?.error(error);
        void reader.cancel(error).catch(() => undefined);
        finalize();
    };
    composed.signal.addEventListener('abort', onAbort, { once: true });
    const body = new globalThis.ReadableStream<Uint8Array>({
        start(controller) {
            streamController = controller;
            if (composed.signal.aborted) onAbort();
        },
        async pull(controller) {
            if (terminated) return;
            try {
                const { done, value } = await reader.read();
                if (composed.signal.aborted) throw cancellationError(lease.signal, callerSignal);
                if (done) {
                    terminated = true;
                    controller.close();
                    finalize();
                    return;
                }
                if (value) controller.enqueue(value);
            } catch (error) {
                if (terminated) return;
                terminated = true;
                controller.error(error);
                finalize();
            }
        },
        async cancel(reason) {
            if (terminated) return;
            terminated = true;
            finalize();
            await reader.cancel(reason);
        },
    });
    return {
        response: new Response(body, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
        }),
        ownsLease: true,
    };
}

async function resolveModelFallbacks(
    failedModel: string,
    config: ResolvedDirectConfig,
    accountSignal: AbortSignal,
): Promise<string[]> {
    throwIfAccountLeaseAborted({ signal: accountSignal });
    try {
        const settings = await loadCustomAiProviderSettings();
        throwIfAccountLeaseAborted({ signal: accountSignal });
        const contextById: Record<string, number> = {};
        for (const model of settings.models) {
            contextById[model.id] = model.contextWindow;
        }
        if (config.contextWindow && config.model) {
            contextById[config.model] = config.contextWindow;
        }
        const queue = buildModelFallbackQueue(failedModel, {
            cachedModelIds: settings.models.map((m) => m.id),
            recentModelIds: settings.recentModelIds,
            configModel: config.model,
            flashModel: config.flashModel,
            freeOnly: settings.freeOnly !== false,
            contextById,
        });
        return queue.slice(0, MAX_MODEL_FALLBACKS);
    } catch {
        throwIfAccountLeaseAborted({ signal: accountSignal });
        return buildModelFallbackQueue(failedModel, {
            configModel: config.model,
            flashModel: config.flashModel,
            freeOnly: true,
        }).slice(0, MAX_MODEL_FALLBACKS);
    }
}

type AttemptOutcome =
    | { kind: 'ok'; response: Response }
    | { kind: 'response'; response: Response; modelMissing: boolean; retryable: boolean }
    | { kind: 'network'; error: unknown };

/**
 * One HTTP attempt. Does not retry — caller owns the 3× / model cascade.
 */
async function singleFetch(
    request: PreparedDirectChatRequest,
    options: DirectChatOptions,
    accountSignal: AbortSignal,
): Promise<AttemptOutcome> {
    try {
        const response = await fetch(request.url, {
            method: 'POST',
            headers: request.headers,
            body: JSON.stringify(request.body),
            ...(options.signal ? { signal: options.signal } : {}),
        });
        throwIfAccountLeaseAborted({ signal: accountSignal });
        if (response.ok) return { kind: 'ok', response };

        const bodyText = await peekResponseText(response);
        throwIfAccountLeaseAborted({ signal: accountSignal });
        const modelMissing = isModelNotFoundError(response.status, bodyText);
        const retryable =
            !modelMissing && request.capabilities.retryableStatuses.has(response.status);
        return { kind: 'response', response, modelMissing, retryable };
    } catch (err) {
        if (accountSignal.aborted) throw accountSwitchCancellationError();
        if (isAbortError(err) || options.signal?.aborted) {
            throw err;
        }
        return { kind: 'network', error: err };
    }
}

/**
 * Fetch with self-heal:
 * 1. Same model — up to 3 attempts on network errors and transient statuses
 *    (429/500/502/503/504, provider-specific).
 * 2. Model missing (404 / "no endpoints" / "model not found") — immediately
 *    cascade to higher-parameter alternates (up to 3), 1 attempt each first
 *    then normal transient retries on the alternate if needed.
 *
 * The body is never fully consumed before a retry decision (clone for peek),
 * so streaming requests re-issue a fresh request on failure.
 */
async function fetchWithSelfHeal(
    request: PreparedDirectChatRequest,
    options: DirectChatOptions,
    config: ResolvedDirectConfig,
    accountSignal: AbortSignal,
): Promise<Response> {
    throwIfAccountLeaseAborted({ signal: accountSignal });
    const primaryModel = request.body.model;
    const modelQueue: string[] = [primaryModel];
    const triedModels = new Set<string>();
    let fallbacksLoaded = false;

    let lastResponse: Response | null = null;
    let lastError: unknown = null;

    while (modelQueue.length > 0) {
        throwIfAccountLeaseAborted({ signal: accountSignal });
        if (options.signal?.aborted) throw createAbortError();
        const model = modelQueue.shift()!;
        if (triedModels.has(model)) continue;
        triedModels.add(model);

        // Fix 1: skip models cached as unavailable — go straight to fallbacks.
        if (isCachedUnavailable(model)) {
            if (!fallbacksLoaded) {
                fallbacksLoaded = true;
                const fallbacks = await resolveModelFallbacks(primaryModel, config, accountSignal);
                for (const next of fallbacks) {
                    if (!triedModels.has(next) && !modelQueue.includes(next)) {
                        modelQueue.push(next);
                    }
                }
                if (fallbacks.length > 0) {
                    console.info(
                        `[ai] self-heal: ${model} cached-unavailable; trying ${fallbacks.join(', ')}`
                    );
                }
            }
            continue;
        }

        request.body.model = model;

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            throwIfAccountLeaseAborted({ signal: accountSignal });
            if (options.signal?.aborted) throw createAbortError();

            const outcome = await singleFetch(request, options, accountSignal);
            throwIfAccountLeaseAborted({ signal: accountSignal });

            if (outcome.kind === 'ok') {
                lastResolvedModel = model;
                if (model !== primaryModel) {
                    console.info(
                        `[ai] self-heal: switched model ${primaryModel} → ${model} after model error`
                    );
                } else if (attempt > 0) {
                    console.info(
                        `[ai] self-heal: succeeded on attempt ${attempt + 1} for ${model}`
                    );
                }
                return outcome.response;
            }

            if (outcome.kind === 'network') {
                lastError = outcome.error;
                lastResponse = null;
                if (attempt < MAX_ATTEMPTS - 1) {
                    await delayUnlessAccountSwitched(backoffMs(attempt), accountSignal);
                    continue;
                }
                // Exhausted retries on this model — try next model if any.
                break;
            }

            // HTTP error response
            lastResponse = outcome.response;
            lastError = null;

            if (outcome.modelMissing) {
                cacheUnavailable(model);
                if (!fallbacksLoaded) {
                    fallbacksLoaded = true;
                    const fallbacks = await resolveModelFallbacks(primaryModel, config, accountSignal);
                    for (const next of fallbacks) {
                        if (!triedModels.has(next) && !modelQueue.includes(next)) {
                            modelQueue.push(next);
                        }
                    }
                    if (fallbacks.length > 0) {
                        console.info(
                            `[ai] self-heal: model unavailable (${outcome.response.status}) for ${model}; ` +
                            `trying ${fallbacks.join(', ')}`
                        );
                    }
                }
                // Do not burn remaining same-model attempts on a missing id.
                break;
            }

            if (outcome.retryable && attempt < MAX_ATTEMPTS - 1) {
                await delayUnlessAccountSwitched(backoffMs(attempt), accountSignal);
                continue;
            }

            // Non-retryable HTTP (auth, bad request, etc.) — stop entirely.
            if (!outcome.retryable) {
                return outcome.response;
            }

            // Retryable but out of attempts for this model.
            break;
        }
    }

    throwIfAccountLeaseAborted({ signal: accountSignal });
    if (lastResponse) return lastResponse;
    throw lastError ?? new Error('AI request failed after self-heal retries.');
}

export async function fetchDirectChatCompletion(
    payload: DirectChatRequest,
    options: DirectChatOptions = {}
): Promise<Response> {
    const lease = acquireAccountOperationLease('byok-inference-fetch');
    let request: PreparedDirectChatRequest;
    let config: ResolvedDirectConfig;
    try {
        config = await getResolvedDirectConfig(lease.signal);
        throwIfAccountLeaseAborted(lease);
        request = buildPreparedDirectChatRequest(payload, options, config);
    } catch (error) {
        lease.release();
        if (lease.signal.aborted) throw accountSwitchCancellationError();
        throw error;
    }

    const composed = composeAbortSignals(lease.signal, options.signal);
    let ownsLease = false;
    try {
        const response = await fetchWithSelfHeal(
            request,
            { ...options, signal: composed.signal },
            config,
            lease.signal,
        );
        throwIfAccountLeaseAborted(lease);
        const isEventStream = (response.headers.get('content-type') || '')
            .includes('text/event-stream');
        if (payload.stream && response.ok && isEventStream) {
            const retained = retainLeaseForStreamingResponse(
                response,
                lease,
                composed,
                options.signal,
            );
            ownsLease = retained.ownsLease;
            return retained.response;
        }
        return response;
    } catch (err) {
        if (lease.signal.aborted) throw accountSwitchCancellationError();
        if (isAbortError(err)) throw err;
        throw buildConnectionError(request, request.configSource);
    } finally {
        if (!ownsLease) {
            composed.cleanup();
            lease.release();
        }
    }
}

export { DirectConfigError, getDirectConfig, getResolvedDirectConfig } from './directConfig';
export type { DirectConfig, ResolvedDirectConfig } from './directConfig';
