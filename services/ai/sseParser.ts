import {
    ChatAccumulator,
    ChatUsage,
    ParsedSseChunk,
    SimulatedStreamingOptions,
    StreamingCallback,
    CompleteCallback,
} from './chatTypes';

function parseUsageField(raw: unknown): ChatUsage | null {
    if (!raw || typeof raw !== 'object') return null;
    const u = raw as Record<string, unknown>;
    const out: ChatUsage = {};
    if (typeof u.prompt_tokens === 'number') out.prompt_tokens = u.prompt_tokens;
    if (typeof u.completion_tokens === 'number') out.completion_tokens = u.completion_tokens;
    if (typeof u.total_tokens === 'number') out.total_tokens = u.total_tokens;
    if (
        out.prompt_tokens === undefined
        && out.completion_tokens === undefined
        && out.total_tokens === undefined
    ) {
        return null;
    }
    return out;
}

export function parseSseLine(line: string): ParsedSseChunk | null {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('data:')) return null;
    const payload = trimmed.replace(/^data:\s?/, '');
    if (!payload) return null;
    if (payload === '[DONE]') return { done: true };
    try {
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta;
        return {
            content: delta?.content,
            reasoning: delta?.reasoning || delta?.reasoning_content,
            usage: parseUsageField(parsed.usage),
        };
    } catch {
        return null;
    }
}

export function appendChunk(
    accumulator: ChatAccumulator,
    chunk: ParsedSseChunk,
    onChunk: StreamingCallback
): void {
    const { content, reasoning } = chunk;
    if (content) accumulator.content += content;
    if (reasoning) accumulator.reasoning += reasoning;
    if (chunk.usage) accumulator.usage = chunk.usage;
    if (content || reasoning) onChunk(content || '', reasoning);
}

function assertFinalContent(accumulator: ChatAccumulator): void {
    if (accumulator.content.trim().length > 0) return;
    if (accumulator.reasoning.trim().length > 0) {
        throw new Error('AI response ended after reasoning without a final answer. Please retry.');
    }
    throw new Error('AI response did not include a final answer. Please retry.');
}

function decodeStreamChunk(
    decoder: TextDecoder,
    value: Uint8Array | undefined,
    buffer: string
): string {
    if (!value) return buffer;
    return buffer + decoder.decode(value, { stream: true });
}

function splitStreamBuffer(buffer: string): { lines: string[]; remainder: string } {
    const lines = buffer.split('\n');
    const remainder = lines.pop() || '';
    return { lines, remainder };
}

function processStreamLines(
    lines: string[],
    accumulator: ChatAccumulator,
    onChunk: StreamingCallback,
    onComplete: CompleteCallback
): boolean {
    for (const line of lines) {
        const parsed = parseSseLine(line);
        if (!parsed) continue;
        if (parsed.done) {
            assertFinalContent(accumulator);
            onComplete(accumulator.content, accumulator.reasoning);
            return true;
        }
        appendChunk(accumulator, parsed, onChunk);
    }
    return false;
}

/** PR8c: optional usage callback when the stream carries a usage chunk. */
export type StreamUsageCallback = (usage: ChatUsage | null) => void;

export async function readStreamResponse(
    body: { getReader: () => { read: () => Promise<{ done: boolean; value?: Uint8Array }> } },
    onChunk: StreamingCallback,
    onComplete: CompleteCallback,
    onUsage?: StreamUsageCallback
): Promise<ChatUsage | null> {
    const reader = body.getReader();
    const decoder = new TextDecoder('utf-8');
    const accumulator: ChatAccumulator = { content: '', reasoning: '', usage: null };
    let buffer = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer = decodeStreamChunk(decoder, value, buffer);
        const { lines, remainder } = splitStreamBuffer(buffer);
        buffer = remainder;
        if (processStreamLines(lines, accumulator, onChunk, onComplete)) {
            const usage = accumulator.usage ?? null;
            onUsage?.(usage);
            return usage;
        }
    }
    assertFinalContent(accumulator);
    onComplete(accumulator.content, accumulator.reasoning);
    const usage = accumulator.usage ?? null;
    onUsage?.(usage);
    return usage;
}

function parseJsonSafely(rawText: string): unknown {
    try {
        return JSON.parse(rawText);
    } catch {
        return null;
    }
}

function extractMessageContent(data: unknown): ChatAccumulator {
    const message = (data as { choices?: { message?: { content?: string; reasoning?: string; reasoning_content?: string } }[]; usage?: unknown })
        ?.choices?.[0]?.message;
    return {
        content: message?.content || '',
        reasoning: message?.reasoning || message?.reasoning_content || '',
        usage: parseUsageField((data as { usage?: unknown })?.usage),
    };
}

function parseSseTranscript(rawText: string): ChatAccumulator | null {
    const lines = rawText.split('\n');
    const accumulator: ChatAccumulator = { content: '', reasoning: '', usage: null };
    let parsedChunks = 0;
    for (const line of lines) {
        const parsed = parseSseLine(line);
        if (!parsed || parsed.done) continue;
        if (parsed.content) accumulator.content += parsed.content;
        if (parsed.reasoning) accumulator.reasoning += parsed.reasoning;
        if (parsed.usage) accumulator.usage = parsed.usage;
        if (parsed.content || parsed.reasoning) parsedChunks += 1;
    }
    return parsedChunks > 0 ? accumulator : null;
}

export async function readNonStreamingResponse(response: Response): Promise<ChatAccumulator> {
    const rawText = await response.text();
    const parsed = parseJsonSafely(rawText);
    if (parsed) {
        const result = extractMessageContent(parsed);
        assertFinalContent(result);
        return result;
    }
    const sseContent = parseSseTranscript(rawText);
    if (sseContent) {
        assertFinalContent(sseContent);
        return sseContent;
    }
    const preview = rawText.slice(0, 200);
    throw new Error(`AI response was not valid JSON. Preview: ${preview}`);
}

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function emitSimulatedStreaming(
    result: ChatAccumulator,
    onChunk: StreamingCallback,
    options?: SimulatedStreamingOptions
): Promise<void> {
    const content = result.content || '';
    const reasoning = result.reasoning || '';
    if (!content && !reasoning) return;
    const chunkSize = options?.chunkSize ?? 18;
    const chunkDelayMs = options?.chunkDelayMs ?? 16;
    const contentChunks: string[] = [];
    for (let i = 0; i < content.length; i += chunkSize) {
        contentChunks.push(content.slice(i, i + chunkSize));
    }
    if (contentChunks.length === 0) {
        onChunk('', reasoning);
        return;
    }
    for (let i = 0; i < contentChunks.length; i += 1) {
        const chunk = contentChunks[i];
        onChunk(chunk, i === 0 ? reasoning : undefined);
        if (i < contentChunks.length - 1) await wait(chunkDelayMs);
    }
}

function extractProviderErrorMessage(text: string): string | null {
    const parsed = parseJsonSafely(text);
    if (!parsed || typeof parsed !== 'object') return null;
    const error = (parsed as { error?: unknown }).error;
    if (!error) return null;
    if (typeof error === 'string') return error;
    if (typeof error === 'object' && error !== null) {
        const message = (error as { message?: unknown }).message;
        if (typeof message === 'string') return message;
        const type = (error as { type?: unknown }).type;
        if (typeof type === 'string') return type;
    }
    return null;
}

export async function buildResponseError(
    response: Response,
    context: string,
    streamingAvailable: boolean
): Promise<Error> {
    const responseText = await response.text().catch(() => '');
    const preview = responseText.slice(0, 200);
    const providerMessage = extractProviderErrorMessage(responseText);
    const parts = [
        `${context} (status ${response.status}, streaming=${streamingAvailable}).`,
    ];
    if (providerMessage) parts.push(`Provider: ${providerMessage}`);
    if (preview) parts.push(`Preview: ${preview}`);
    return new Error(parts.join(' '));
}
