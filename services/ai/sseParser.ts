import {
    ChatAccumulator,
    ParsedSseChunk,
    SimulatedStreamingOptions,
    StreamingCallback,
    CompleteCallback,
} from './chatTypes';

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
    if (content || reasoning) onChunk(content || '', reasoning);
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
            onComplete(accumulator.content, accumulator.reasoning);
            return true;
        }
        appendChunk(accumulator, parsed, onChunk);
    }
    return false;
}

export async function readStreamResponse(
    body: { getReader: () => { read: () => Promise<{ done: boolean; value?: Uint8Array }> } },
    onChunk: StreamingCallback,
    onComplete: CompleteCallback
): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder('utf-8');
    const accumulator: ChatAccumulator = { content: '', reasoning: '' };
    let buffer = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer = decodeStreamChunk(decoder, value, buffer);
        const { lines, remainder } = splitStreamBuffer(buffer);
        buffer = remainder;
        if (processStreamLines(lines, accumulator, onChunk, onComplete)) return;
    }
    onComplete(accumulator.content, accumulator.reasoning);
}

function parseJsonSafely(rawText: string): unknown {
    try {
        return JSON.parse(rawText);
    } catch {
        return null;
    }
}

function extractMessageContent(data: unknown): ChatAccumulator {
    const message = (data as { choices?: Array<{ message?: { content?: string; reasoning?: string; reasoning_content?: string } }> })
        ?.choices?.[0]?.message;
    return {
        content: message?.content || '',
        reasoning: message?.reasoning || message?.reasoning_content || '',
    };
}

function parseSseTranscript(rawText: string): ChatAccumulator | null {
    const lines = rawText.split('\n');
    const accumulator: ChatAccumulator = { content: '', reasoning: '' };
    let parsedChunks = 0;
    for (const line of lines) {
        const parsed = parseSseLine(line);
        if (!parsed || parsed.done) continue;
        if (parsed.content) accumulator.content += parsed.content;
        if (parsed.reasoning) accumulator.reasoning += parsed.reasoning;
        if (parsed.content || parsed.reasoning) parsedChunks += 1;
    }
    return parsedChunks > 0 ? accumulator : null;
}

export async function readNonStreamingResponse(response: Response): Promise<ChatAccumulator> {
    const rawText = await response.text();
    const parsed = parseJsonSafely(rawText);
    if (parsed) return extractMessageContent(parsed);
    const sseContent = parseSseTranscript(rawText);
    if (sseContent) return sseContent;
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

export async function buildResponseError(
    response: Response,
    context: string,
    streamingAvailable: boolean
): Promise<Error> {
    const responseText = await response.text().catch(() => '');
    const preview = responseText.slice(0, 200);
    return new Error(`${context} (status ${response.status}, streaming=${streamingAvailable}).${preview ? ` Preview: ${preview}` : ''}`);
}
