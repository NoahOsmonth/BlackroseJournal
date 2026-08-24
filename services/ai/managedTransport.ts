import {
    parseNormalizedInferenceEvent,
    type InferenceMessage,
    type InferenceMessageToolCall,
    type InferenceTool,
    type NormalizedInferenceEvent,
    type NormalizedInferenceRequest,
} from '@blackrose/ai-control-plane-contracts';
import { getSupabaseClient } from '@/services/supabase/supabaseClient';
import {
    acquireAccountOperationLease,
    runAccountBoundOperation,
} from '@/services/account/accountRuntime';
import type { DirectChatOptions, DirectChatRequest } from './directTransport';

export interface PreparedManagedChatRequest {
    url: string;
    headers: Record<string, string>;
    body: NormalizedInferenceRequest;
}

interface ManagedSessionIdentity {
    readonly accessToken: string;
    readonly userId: string;
}

type ManagedSessionProvider = (signal?: AbortSignal) => Promise<ManagedSessionIdentity | null>;

const defaultSessionProvider: ManagedSessionProvider = async () => {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error) throw new Error('Unable to verify the managed AI session.');
    if (data.session?.user?.is_anonymous) return null;
    const accessToken = data.session?.access_token;
    const userId = data.session?.user?.id;
    return accessToken && userId ? { accessToken, userId } : null;
};

let sessionProvider: ManagedSessionProvider = defaultSessionProvider;

export function setManagedTransportSessionProvider(provider: ManagedSessionProvider): void {
    sessionProvider = provider;
}

export function resetManagedTransportSessionProvider(): void {
    sessionProvider = defaultSessionProvider;
}

function gatewayUrl(): string {
    const raw = process.env.EXPO_PUBLIC_AGENT_BASE_URL?.trim();
    if (!raw) {
        throw new Error('Managed AI is unavailable because EXPO_PUBLIC_AGENT_BASE_URL is not configured.');
    }
    return `${raw.replace(/\/$/, '')}/v1/ai/chat/completions`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
}

function normalizeTools(tools: unknown[] | undefined): InferenceTool[] | undefined {
    if (!tools?.length) return undefined;
    const normalized: InferenceTool[] = [];
    for (const item of tools) {
        const record = asRecord(item);
        const fn = asRecord(record?.function);
        if (!fn || typeof fn.name !== 'string') continue;
        const schema = asRecord(fn.parameters) ?? {};
        normalized.push({
            name: fn.name,
            description: typeof fn.description === 'string' ? fn.description : '',
            inputSchema: schema as InferenceTool['inputSchema'],
        });
    }
    return normalized.length > 0 ? normalized : undefined;
}

function normalizeToolChoice(
    choice: DirectChatRequest['tool_choice']
): NormalizedInferenceRequest['toolChoice'] | undefined {
    if (!choice) return undefined;
    if (choice === 'auto' || choice === 'none') return choice;
    return { name: choice.function.name };
}

function normalizeMessages(messages: DirectChatRequest['messages']): {
    systemInstruction?: string;
    messages: InferenceMessage[];
} {
    const systemParts: string[] = [];
    const normalized: InferenceMessage[] = [];
    for (const message of messages) {
        const content = message.content ?? '';
        if (message.role === 'system') {
            if (content) systemParts.push(content);
            continue;
        }
        if (
            message.role !== 'user'
            && message.role !== 'assistant'
            && message.role !== 'tool'
        ) continue;
        const toolCalls: InferenceMessageToolCall[] = [];
        if (message.role === 'assistant' && Array.isArray(message.tool_calls)) {
            for (const rawCall of message.tool_calls) {
                const call = asRecord(rawCall);
                const fn = asRecord(call?.function);
                if (
                    typeof call?.id === 'string'
                    && typeof fn?.name === 'string'
                    && typeof fn.arguments === 'string'
                ) {
                    toolCalls.push({ id: call.id, name: fn.name, arguments: fn.arguments });
                }
            }
        }
        normalized.push({
            role: message.role,
            content,
            ...(message.name ? { name: message.name } : {}),
            ...(message.tool_call_id ? { toolCallId: message.tool_call_id } : {}),
            ...(toolCalls.length > 0 ? { toolCalls } : {}),
        });
    }
    return {
        ...(systemParts.length > 0 ? { systemInstruction: systemParts.join('\n\n') } : {}),
        messages: normalized,
    };
}

export async function prepareManagedChatRequest(
    payload: DirectChatRequest,
    options: DirectChatOptions = {}
): Promise<PreparedManagedChatRequest> {
    return runAccountBoundOperation('managed-inference-session', async ({ accountId, signal }) => {
        const session = await sessionProvider(signal);
        if (signal.aborted) {
            throw new Error('Managed AI request was cancelled by an account switch.');
        }
        if (!session) throw new Error('Sign in to use managed AI.');
        if (!accountId || session.userId !== accountId) {
            throw new Error('Managed AI session does not match the active account.');
        }
        const normalizedMessages = normalizeMessages(payload.messages);
        const tools = normalizeTools(payload.tools);
        return {
            url: gatewayUrl(),
            headers: {
                'Content-Type': 'application/json',
                Accept: payload.stream ? 'text/event-stream' : 'application/json',
                Authorization: `Bearer ${session.accessToken}`,
                ...(options.headers ?? {}),
            },
            body: {
                purpose: options.modelPurpose === 'flash' ? 'flash' : 'chat',
                ...normalizedMessages,
                ...(tools ? { tools } : {}),
                ...(payload.tools?.length ? { toolChoice: normalizeToolChoice(payload.tool_choice) ?? 'auto' } : {}),
                ...(payload.response_format ? { responseFormat: payload.response_format } : {}),
                ...(payload.temperature !== undefined ? { temperature: payload.temperature } : {}),
                ...(payload.top_p !== undefined ? { topP: payload.top_p } : {}),
                ...(payload.max_tokens !== undefined ? { maxOutputTokens: payload.max_tokens } : {}),
                stream: payload.stream ?? false,
            },
        };
    });
}

interface ToolCallAccumulator {
    id?: string;
    name?: string;
    arguments: string;
}

interface EventAccumulator {
    content: string;
    toolCalls: Map<number, ToolCallAccumulator>;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    finishReason: string | null;
    error?: NormalizedInferenceEvent & { type: 'error' };
}

function createAccumulator(): EventAccumulator {
    return { content: '', toolCalls: new Map(), finishReason: null };
}

function appendEvent(accumulator: EventAccumulator, event: NormalizedInferenceEvent): void {
    if (event.type === 'text_delta') accumulator.content += event.text;
    if (event.type === 'tool_call_delta') {
        const current = accumulator.toolCalls.get(event.index) ?? { arguments: '' };
        if (event.id) current.id = event.id;
        if (event.name) current.name = event.name;
        current.arguments += event.argumentsDelta;
        accumulator.toolCalls.set(event.index, current);
    }
    if (event.type === 'usage') {
        accumulator.usage = {
            prompt_tokens: event.inputTokens,
            completion_tokens: event.outputTokens,
            total_tokens: event.totalTokens,
        };
    }
    if (event.type === 'completion') accumulator.finishReason = event.reason;
    if (event.type === 'error') accumulator.error = event;
}

function toolCallsJson(accumulator: EventAccumulator): unknown[] | undefined {
    if (accumulator.toolCalls.size === 0) return undefined;
    return [...accumulator.toolCalls.entries()]
        .sort(([left], [right]) => left - right)
        .map(([index, call]) => ({
            id: call.id ?? `managed-call-${index}`,
            type: 'function',
            function: { name: call.name ?? '', arguments: call.arguments },
        }));
}

function normalizedErrorResponse(event: EventAccumulator['error']): Response {
    const error = event?.error;
    const status = error?.status && error.status >= 400 && error.status <= 599 ? error.status : 502;
    return jsonResponse({ error: {
        type: error?.code ?? 'upstream_error',
        message: error?.message ?? 'Managed AI request failed.',
    } }, status);
}

function jsonResponse(value: unknown, status = 200): Response {
    return new Response(JSON.stringify(value), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

function convertNonStreamingEvents(raw: unknown): Response {
    const record = asRecord(raw);
    const rawEvents = Array.isArray(record?.events) ? record.events : [];
    const accumulator = createAccumulator();
    for (const rawEvent of rawEvents) appendEvent(accumulator, parseNormalizedInferenceEvent(rawEvent));
    if (accumulator.error) return normalizedErrorResponse(accumulator.error);
    const toolCalls = toolCallsJson(accumulator);
    return jsonResponse({
        choices: [{
            message: {
                content: accumulator.content,
                ...(toolCalls ? { tool_calls: toolCalls } : {}),
            },
            finish_reason: accumulator.finishReason,
        }],
        ...(accumulator.usage ? { usage: accumulator.usage } : {}),
    });
}

export function managedEventToOpenAiSse(event: NormalizedInferenceEvent): string {
    if (event.type === 'text_delta') {
        return `data: ${JSON.stringify({ choices: [{ delta: { content: event.text } }] })}\n\n`;
    }
    if (event.type === 'tool_call_delta') {
        return `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{
            index: event.index,
            ...(event.id ? { id: event.id } : {}),
            type: 'function',
            function: {
                ...(event.name ? { name: event.name } : {}),
                arguments: event.argumentsDelta,
            },
        }] } }] })}\n\n`;
    }
    if (event.type === 'usage') {
        return `data: ${JSON.stringify({ choices: [], usage: {
            prompt_tokens: event.inputTokens,
            completion_tokens: event.outputTokens,
            total_tokens: event.totalTokens,
        } })}\n\n`;
    }
    if (event.type === 'completion') {
        return `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: event.reason }] })}\n\n`;
    }
    return `data: ${JSON.stringify({ error: {
        type: event.error.code,
        message: event.error.message,
    } })}\n\n`;
}

function convertManagedSseLine(line: string): string {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return '';
    const data = trimmed.slice(5).trim();
    if (data === '[DONE]') return 'data: [DONE]\n\n';
    if (!data) return '';
    try {
        return managedEventToOpenAiSse(parseNormalizedInferenceEvent(JSON.parse(data)));
    } catch {
        return '';
    }
}

interface ConvertedSseResponse {
    readonly response: Response;
    readonly ownsAccountLease: boolean;
}

function accountSwitchCancellationError(): Error {
    return new Error('Managed AI request was cancelled by an account switch.');
}

function managedCancellationError(
    accountSignal: AbortSignal,
    callerSignal?: AbortSignal,
): Error {
    if (accountSignal.aborted) return accountSwitchCancellationError();
    if (callerSignal?.reason instanceof Error) return callerSignal.reason;
    return new Error('Managed AI request was cancelled.');
}

function composeAbortSignals(signals: readonly (AbortSignal | undefined)[]): {
    signal: AbortSignal;
    cleanup(): void;
} {
    const controller = new AbortController();
    const activeSignals = signals.filter((signal): signal is AbortSignal => Boolean(signal));
    const onAbort = (event: Event) => {
        const source = event.target as AbortSignal;
        if (!controller.signal.aborted) controller.abort(source.reason);
    };
    activeSignals.forEach((signal) => {
        if (signal.aborted && !controller.signal.aborted) {
            controller.abort(signal.reason);
        } else {
            signal.addEventListener('abort', onAbort, { once: true });
        }
    });
    return {
        signal: controller.signal,
        cleanup: () => activeSignals.forEach((signal) => (
            signal.removeEventListener('abort', onAbort)
        )),
    };
}

async function convertSseResponse(
    response: Response,
    signal: AbortSignal,
    accountSignal: AbortSignal,
    callerSignal: AbortSignal | undefined,
    finalizeLease: () => void,
): Promise<ConvertedSseResponse> {
    if (!response.body) return { response, ownsAccountLease: false };
    if (typeof globalThis.ReadableStream !== 'function') {
        const transcript = await response.text();
        const converted = transcript.split(/\r?\n/)
            .map(convertManagedSseLine)
            .join('');
        return {
            response: new Response(converted, {
                status: response.status,
                statusText: response.statusText,
                headers: { 'content-type': 'text/event-stream' },
            }),
            ownsAccountLease: false,
        };
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    const encoder = new TextEncoder();
    let buffer = '';
    let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
    let terminated = false;
    let finalized = false;
    const finalize = () => {
        if (finalized) return;
        finalized = true;
        signal.removeEventListener('abort', onAbort);
        finalizeLease();
    };
    const onAbort = () => {
        if (terminated) return;
        terminated = true;
        const error = managedCancellationError(accountSignal, callerSignal);
        const upstreamCancellation = reader.cancel(error);
        streamController?.error(error);
        void upstreamCancellation.catch(() => undefined);
        finalize();
    };
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
    const body = new globalThis.ReadableStream<Uint8Array>({
        async pull(controller) {
            streamController = controller;
            try {
                while (!terminated) {
                    const { done, value } = await reader.read();
                    if (signal.aborted) throw accountSwitchCancellationError();
                    if (done) {
                        if (buffer.trim()) processLine(buffer, controller);
                        terminated = true;
                        controller.close();
                        finalize();
                        return;
                    }
                    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
                    const lines = buffer.split('\n');
                    buffer = lines.pop() ?? '';
                    let emitted = false;
                    for (const line of lines) emitted = processLine(line, controller) || emitted;
                    if (emitted) return;
                }
            } catch (error) {
                if (!terminated) {
                    terminated = true;
                    controller.error(error);
                    finalize();
                }
            }
        },
        async cancel(reason) {
            if (terminated) return;
            terminated = true;
            finalize();
            await reader.cancel(reason);
        },
    });
    function processLine(line: string, controller: ReadableStreamDefaultController<Uint8Array>): boolean {
        const converted = convertManagedSseLine(line);
        if (!converted) return false;
        controller.enqueue(encoder.encode(converted));
        return true;
    }
    return {
        response: new Response(body, {
            status: response.status,
            statusText: response.statusText,
            headers: { 'content-type': 'text/event-stream' },
        }),
        ownsAccountLease: true,
    };
}

export async function fetchManagedChatCompletion(
    payload: DirectChatRequest,
    options: DirectChatOptions = {}
): Promise<Response> {
    const lease = acquireAccountOperationLease('managed-inference-fetch');
    const composed = composeAbortSignals([lease.signal, options.signal]);
    let responseOwnsLease = false;
    const release = () => {
        composed.cleanup();
        lease.release();
    };
    try {
        const request = await prepareManagedChatRequest(payload, {
            ...options,
            signal: composed.signal,
        });
        if (composed.signal.aborted) {
            throw managedCancellationError(lease.signal, options.signal);
        }
        const response = await fetch(request.url, {
            method: 'POST',
            headers: request.headers,
            body: JSON.stringify(request.body),
            signal: composed.signal,
        });
        if (!response.ok) {
            const body = await response.arrayBuffer();
            return new Response(body, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
            });
        }
        if (payload.stream) {
            const converted = await convertSseResponse(
                response,
                composed.signal,
                lease.signal,
                options.signal,
                release,
            );
            responseOwnsLease = converted.ownsAccountLease;
            return converted.response;
        }
        const raw = await response.json();
        return convertNonStreamingEvents(raw);
    } finally {
        if (!responseOwnsLease) release();
    }
}
