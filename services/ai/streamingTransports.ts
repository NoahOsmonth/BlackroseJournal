import { prepareDirectChatRequest, fetchDirectChatCompletion } from './directTransport';
import {
    ChatAccumulator,
    ChatRequestPayload,
    CompleteCallback,
    StreamingCallback,
} from './chatTypes';
import { appendChunk, parseSseLine, readNonStreamingResponse, buildResponseError } from './sseParser';

function hasReadableStream(body: unknown): body is { getReader: () => { read: () => Promise<{ done: boolean; value?: Uint8Array }> } } {
    return Boolean(body && typeof (body as { getReader?: unknown }).getReader === 'function');
}

function hasXmlHttpRequest(): boolean {
    return typeof globalThis !== 'undefined' && typeof globalThis.XMLHttpRequest === 'function';
}

function isOkStatus(status: number): boolean {
    return status >= 200 && status < 300;
}

export async function fetchChatCompletion(payload: ChatRequestPayload): Promise<Response> {
    return fetchDirectChatCompletion(payload);
}

export async function streamChatWithXhr(
    payload: ChatRequestPayload,
    onChunk: StreamingCallback,
    onComplete: CompleteCallback
): Promise<boolean> {
    if (!hasXmlHttpRequest()) return false;
    return new Promise((resolve, reject) => {
        const request = prepareDirectChatRequest(payload);
        const xhr = new globalThis.XMLHttpRequest();
        const accumulator: ChatAccumulator = { content: '', reasoning: '' };
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
                const parsed = parseSseLine(line);
                if (!parsed) continue;
                if (parsed.done) {
                    settle(() => {
                        onComplete(accumulator.content, accumulator.reasoning);
                        resolve(true);
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
                settle(() => {
                    onComplete(accumulator.content, accumulator.reasoning);
                    resolve(true);
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

export { hasReadableStream, readNonStreamingResponse, buildResponseError };
