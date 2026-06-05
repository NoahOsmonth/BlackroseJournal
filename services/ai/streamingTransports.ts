import { getAgentConfig } from '@/services/agent/agentConfig';
import { postAgent } from '@/services/agent/agentClient';
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

function hasWebSocket(): boolean {
    return typeof globalThis !== 'undefined' && typeof globalThis.WebSocket === 'function';
}

function shouldPreferWebSocketStreaming(): boolean {
    const envPreference = typeof process !== 'undefined'
        ? (process.env.EXPO_PUBLIC_AGENT_STREAMING_TRANSPORT || process.env.AGENT_STREAMING_TRANSPORT)
        : undefined;
    return envPreference === 'ws';
}

function buildAgentUrl(path: string): string {
    const { apiBaseUrl } = getAgentConfig();
    const baseUrl = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
    return `${baseUrl}${path}`;
}

function buildAgentWsUrl(path: string, token?: string): string {
    const { apiBaseUrl } = getAgentConfig();
    const baseUrl = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
    const wsBaseUrl = baseUrl.startsWith('wss://') || baseUrl.startsWith('ws://')
        ? baseUrl
        : baseUrl.startsWith('https://')
            ? `wss://${baseUrl.slice('https://'.length)}`
            : baseUrl.startsWith('http://')
                ? `ws://${baseUrl.slice('http://'.length)}`
                : baseUrl;
    const url = new URL(`${wsBaseUrl}${path}`);
    if (token) url.searchParams.set('token', token);
    return url.toString();
}

function isOkStatus(status: number): boolean {
    return status >= 200 && status < 300;
}

export async function fetchChatCompletion(payload: ChatRequestPayload): Promise<Response> {
    return postAgent('/v1/chat/completions', payload);
}

export async function streamChatWithWebSocket(
    payload: ChatRequestPayload,
    onChunk: StreamingCallback,
    onComplete: CompleteCallback
): Promise<boolean> {
    if (!shouldPreferWebSocketStreaming() || !hasWebSocket()) return false;
    const { apiKey } = getAgentConfig();
    const url = buildAgentWsUrl('/v1/chat/ws', apiKey);
    return new Promise((resolve, reject) => {
        const ws = new globalThis.WebSocket(url);
        const accumulator: ChatAccumulator = { content: '', reasoning: '' };
        let settled = false;
        const settle = (callback: () => void) => {
            if (settled) return;
            settled = true;
            callback();
        };
        const timeoutId = setTimeout(() => {
            settle(() => {
                try { ws.close(); } catch { /* ignore */ }
                reject(new Error('AI request timed out while establishing WebSocket streaming.'));
            });
        }, 10_000);
        const clearTimer = () => clearTimeout(timeoutId);
        ws.onopen = () => {
            try {
                ws.send(JSON.stringify(payload));
            } catch (error) {
                clearTimer();
                settle(() => reject(error instanceof Error ? error : new Error('Failed to send WebSocket payload.')));
            }
        };
        ws.onmessage = (event) => {
            const raw = typeof event.data === 'string' ? event.data : String(event.data ?? '');
            if (!raw) return;
            let parsed: unknown;
            try { parsed = JSON.parse(raw); } catch { return; }
            const message = parsed as { type?: string; content?: unknown; reasoning?: unknown; message?: unknown };
            if (message.type === 'delta') {
                clearTimer();
                appendChunk(
                    accumulator,
                    {
                        content: typeof message.content === 'string' ? message.content : undefined,
                        reasoning: typeof message.reasoning === 'string' ? message.reasoning : undefined,
                    },
                    onChunk
                );
                return;
            }
            if (message.type === 'done') {
                clearTimer();
                settle(() => {
                    onComplete(accumulator.content, accumulator.reasoning);
                    resolve(true);
                });
                try { ws.close(); } catch { /* ignore */ }
                return;
            }
            if (message.type === 'error') {
                clearTimer();
                settle(() => reject(new Error(
                    typeof message.message === 'string' ? message.message : 'WebSocket streaming error.'
                )));
                try { ws.close(); } catch { /* ignore */ }
            }
        };
        ws.onerror = () => {
            clearTimer();
            settle(() => reject(new Error('AI request failed using WebSocket streaming fallback.')));
        };
        ws.onclose = () => {
            clearTimer();
            if (settled) return;
            settle(() => {
                onComplete(accumulator.content, accumulator.reasoning);
                resolve(true);
            });
        };
    });
}

export async function streamChatWithXhr(
    payload: ChatRequestPayload,
    onChunk: StreamingCallback,
    onComplete: CompleteCallback
): Promise<boolean> {
    if (!hasXmlHttpRequest()) return false;
    const { apiKey } = getAgentConfig();
    const url = buildAgentUrl('/v1/chat/completions');
    return new Promise((resolve, reject) => {
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
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        if (apiKey) xhr.setRequestHeader('Authorization', `Bearer ${apiKey}`);
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
        xhr.send(JSON.stringify(payload));
    });
}

export { hasReadableStream, readNonStreamingResponse, buildResponseError };
