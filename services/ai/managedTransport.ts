import {
    parseNormalizedInferenceEvent,
    type InferenceMessage,
    type InferenceMessageToolCall,
    type InferenceTool,
    type NormalizedInferenceEvent,
    type NormalizedInferenceRequest,
} from '@blackrose/ai-control-plane-contracts';
import { getSupabaseClient } from '@/services/supabase/supabaseClient';
import type { DirectChatOptions, DirectChatRequest } from './directTransport';

export interface PreparedManagedChatRequest {
    url: string;
    headers: Record<string, string>;
    body: NormalizedInferenceRequest;
}

type ManagedSessionProvider = () => Promise<string | null>;

const defaultSessionProvider: ManagedSessionProvider = async () => {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error) throw new Error('Unable to verify the managed AI session.');
    if (data.session?.user?.is_anonymous) return null;
    return data.session?.access_token ?? null;
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
    const accessToken = await sessionProvider();
    if (!accessToken) throw new Error('Sign in to use managed AI.');
    const normalizedMessages = normalizeMessages(payload.messages);
    const tools = normalizeTools(payload.tools);
    return {
        url: gatewayUrl(),
        headers: {
            'Content-Type': 'application/json',
            Accept: payload.stream ? 'text/event-stream' : 'application/json',
            Authorization: `Bearer ${accessToken}`,
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
    return Response.json({ error: {
        type: error?.code ?? 'upstream_error',
        message: error?.message ?? 'Managed AI request failed.',
    } }, { status });
}

function convertNonStreamingEvents(raw: unknown): Response {
    const record = asRecord(raw);
    const rawEvents = Array.isArray(record?.events) ? record.events : [];
    const accumulator = createAccumulator();
    for (const rawEvent of rawEvents) appendEvent(accumulator, parseNormalizedInferenceEvent(rawEvent));
    if (accumulator.error) return normalizedErrorResponse(accumulator.error);
    const toolCalls = toolCallsJson(accumulator);
    return Response.json({
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

function convertSseResponse(response: Response): Response {
    if (!response.body) return response;
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    const encoder = new TextEncoder();
    let buffer = '';
    const body = new ReadableStream<Uint8Array>({
        async pull(controller) {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    if (buffer.trim()) processLine(buffer, controller);
                    controller.close();
                    return;
                }
                buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';
                let emitted = false;
                for (const line of lines) emitted = processLine(line, controller) || emitted;
                if (emitted) return;
            }
        },
        cancel(reason) {
            return reader.cancel(reason);
        },
    });
    function processLine(line: string, controller: ReadableStreamDefaultController<Uint8Array>): boolean {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) return false;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            return true;
        }
        if (!data) return false;
        try {
            const event = parseNormalizedInferenceEvent(JSON.parse(data));
            controller.enqueue(encoder.encode(managedEventToOpenAiSse(event)));
            return true;
        } catch {
            return false;
        }
    }
    return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: { ...Object.fromEntries(response.headers.entries()), 'content-type': 'text/event-stream' },
    });
}

export async function fetchManagedChatCompletion(
    payload: DirectChatRequest,
    options: DirectChatOptions = {}
): Promise<Response> {
    const request = await prepareManagedChatRequest(payload, options);
    const response = await fetch(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(request.body),
        ...(options.signal ? { signal: options.signal } : {}),
    });
    if (!response.ok) return response;
    if (payload.stream) return convertSseResponse(response);
    const raw = await response.json();
    return convertNonStreamingEvents(raw);
}
