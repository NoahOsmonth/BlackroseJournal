/**
 * PR4 — Shared SSE stream parser (relocated from agentService.ts:33–60
 * and chatWebSocket.ts:80–117, where the parser lived as a local function
 * duplicated across two layers. PR2 was supposed to deliver this module
 * but the file was missing at PR4 time; this is a relocation, not a
 * new implementation. Behavior is byte-identical to the originals).
 *
 * Used by:
 *  - `agent/agentService.ts` (stream passthrough)
 *  - `ws/chatWebSocket.ts` (forward upstream SSE deltas to clients)
 */
export interface ParsedSseChunk {
    done?: boolean;
    content?: string;
    reasoning?: string;
}

export function parseSseLine(line: string): ParsedSseChunk | null {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('data:')) {
        return null;
    }
    const payload = trimmed.replace(/^data:\s?/, '');
    if (!payload) {
        return null;
    }
    if (payload === '[DONE]') {
        return { done: true };
    }
    try {
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta;
        if (!delta || typeof delta !== 'object') {
            return null;
        }
        const content = typeof delta.content === 'string' ? delta.content : undefined;
        const reasoning = typeof delta.reasoning === 'string'
            ? delta.reasoning
            : (typeof delta.reasoning_content === 'string' ? delta.reasoning_content : undefined);
        if (content === undefined && reasoning === undefined) {
            return null;
        }
        return { content, reasoning };
    } catch {
        return null;
    }
}

export function splitStreamBuffer(buffer: string): { lines: string[]; remainder: string } {
    const normalized = buffer.replace(/\r\n/g, '\n');
    const lines = normalized.split('\n');
    const remainder = lines.pop() || '';
    return { lines, remainder };
}

/**
 * Read a `ReadableStream<Uint8Array>` (the body of an upstream SSE response),
 * accumulate the assistant's `content` and `reasoning` fields, and return
 * them when `[DONE]` is observed (or the stream ends). Each yielded
 * callback receives the latest chunk so the caller can forward/tee it.
 */
export interface ParseSseStreamCallbacks {
    onChunk?: (content: string | undefined, reasoning: string | undefined) => void;
    onDone?: (content: string, reasoning: string) => void;
}

export async function readAssistantContentFromSseStream(
    body: ReadableStream<Uint8Array>,
    callbacks: ParseSseStreamCallbacks = {}
): Promise<{ content: string; reasoning: string }> {
    const reader = body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let content = '';
    let reasoning = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        if (!value) {
            continue;
        }
        buffer += decoder.decode(value, { stream: true });
        const { lines, remainder } = splitStreamBuffer(buffer);
        buffer = remainder;
        for (const line of lines) {
            const parsed = parseSseLine(line);
            if (!parsed) {
                continue;
            }
            if (parsed.done) {
                callbacks.onDone?.(content, reasoning);
                return { content, reasoning };
            }
            if (parsed.content) {
                content += parsed.content;
            }
            if (parsed.reasoning) {
                reasoning += parsed.reasoning;
            }
            if (parsed.content || parsed.reasoning) {
                callbacks.onChunk?.(parsed.content, parsed.reasoning);
            }
        }
    }

    callbacks.onDone?.(content, reasoning);
    return { content, reasoning };
}

/**
 * `parseSseStream` — alias for `readAssistantContentFromSseStream` with
 * no callbacks. The name used by the PR2 contract (per the PR4 plan).
 */
export function parseSseStream(
    body: ReadableStream<Uint8Array>
): Promise<{ content: string; reasoning: string }> {
    return readAssistantContentFromSseStream(body);
}
