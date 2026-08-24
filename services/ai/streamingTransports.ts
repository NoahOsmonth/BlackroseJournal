import {
    ChatAccumulator,
    ChatRequestPayload,
    ChatUsage,
    CompleteCallback,
    StreamingCallback,
} from './chatTypes';
import { fetchAiChatCompletion, parseAiSseLine, prepareAiChatRequest } from './aiTransport';
import { isModelCachedUnavailable } from './directTransport';
import { appendChunk, buildResponseError, readNonStreamingResponse } from './sseParser';

type ReadableStreamLike = {
    getReader: () => { read: () => Promise<{ done: boolean; value?: Uint8Array }> };
};

function hasReadableStream(body: unknown): body is ReadableStreamLike {
    return Boolean(body && typeof (body as { getReader?: unknown }).getReader === 'function');
}

function hasXmlHttpRequest(): boolean {
    return typeof globalThis !== 'undefined' && typeof globalThis.XMLHttpRequest === 'function';
}

function isOkStatus(status: number): boolean {
    return status >= 200 && status < 300;
}

function hasFinalContent(accumulator: ChatAccumulator): boolean {
    return accumulator.content.trim().length > 0;
}

export async function fetchChatCompletion(payload: ChatRequestPayload): Promise<Response> {
    return fetchAiChatCompletion(payload);
}

/** PR8c: stream result includes usage when the provider emits a usage chunk. */
export interface StreamXhrResult {
    ok: boolean;
    usage: ChatUsage | null;
}

export async function streamChatWithXhr(
    payload: ChatRequestPayload,
    onChunk: StreamingCallback,
    onComplete: CompleteCallback
): Promise<StreamXhrResult> {
    if (!hasXmlHttpRequest()) return { ok: false, usage: null };
    const prepared = await prepareAiChatRequest(payload);
    // Fix 5: skip XHR when primary model is known-unavailable (let fetch+self-heal handle it)
    if (prepared.mode === 'byok' && isModelCachedUnavailable(payload.model)) {
        return { ok: false, usage: null };
    }
    const { request } = prepared;
    return new Promise((resolve, reject) => {
        const xhr = new globalThis.XMLHttpRequest();
        const accumulator: ChatAccumulator = { content: '', reasoning: '', usage: null };
        let buffer = '';
        let consumedLength = 0;
        let settled = false;
        const settle = (callback: () => void) => {
            if (settled) return;
            settled = true;
            callback();
        };
        const processIncoming = () => {
            const incoming = xhr.responseText.slice(consumedLength);
            consumedLength = xhr.responseText.length;
            if (!incoming) return;
            buffer += incoming.replace(/\r\n/g, '\n');
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                const parsed = parseAiSseLine(line, prepared.mode);
                if (!parsed) continue;
                if (parsed.error) {
                    settle(() => reject(parsed.error));
                    return;
                }
                if (parsed.done) {
                    settle(() => {
                        if (!hasFinalContent(accumulator)) {
                            reject(new Error('XHR stream ended without a final AI answer.'));
                            return;
                        }
                        onComplete(accumulator.content, accumulator.reasoning);
                        resolve({ ok: true, usage: accumulator.usage ?? null });
                    });
                    return;
                }
                appendChunk(accumulator, parsed, onChunk);
            }
        };
        xhr.open('POST', request.url, true);
        Object.entries(request.headers).forEach(([key, value]) => {
            xhr.setRequestHeader(key, value);
        });
        xhr.onreadystatechange = () => {
            if (xhr.readyState === 3 || xhr.readyState === 4) processIncoming();
        };
        xhr.onprogress = () => processIncoming();
        xhr.onload = () => {
            processIncoming();
            if (settled) return;
            if (isOkStatus(xhr.status)) {
                if (!hasFinalContent(accumulator)) {
                    settle(() => resolve({ ok: false, usage: accumulator.usage ?? null }));
                    return;
                }
                settle(() => {
                    onComplete(accumulator.content, accumulator.reasoning);
                    resolve({ ok: true, usage: accumulator.usage ?? null });
                });
                return;
            }
            const preview = xhr.responseText.slice(0, 200);
            settle(() => reject(new Error(`AI request failed (status ${xhr.status}). Preview: ${preview}`)));
        };
        xhr.onerror = () => {
            settle(() => reject(new Error('AI request failed using XMLHttpRequest streaming fallback.')));
        };
        xhr.send(JSON.stringify(request.body));
    });
}

export { buildResponseError, hasReadableStream, readNonStreamingResponse };
