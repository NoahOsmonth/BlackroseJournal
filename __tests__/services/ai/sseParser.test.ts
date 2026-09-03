import {
    appendChunk,
    buildResponseError,
    parseSseLine,
    readNonStreamingResponse,
    readStreamResponse,
} from '../../../services/ai/sseParser';
import type { ChatAccumulator } from '../../../services/ai/chatTypes';

function encode(text: string): Uint8Array {
    return new TextEncoder().encode(text);
}

function streamBody(chunks: string[]) {
    const cancel = jest.fn(async () => undefined);
    let index = 0;
    const reader = {
        cancel,
        read: jest.fn(async () => {
            if (index >= chunks.length) {
                return { done: true as const };
            }
            const value = encode(chunks[index]);
            index += 1;
            return { done: false as const, value };
        }),
    };
    return { body: { getReader: () => reader }, reader, cancel };
}

function responseWithText(text: string, status = 200): Response {
    return { status, text: async () => text } as Response;
}

describe('parseSseLine', () => {
    it('extracts delta content from a data line', () => {
        const chunk = parseSseLine('data: {"choices":[{"delta":{"content":"Hello"}}]}');
        expect(chunk?.content).toBe('Hello');
        expect(chunk?.done).toBeUndefined();
    });

    it('extracts reasoning from either reasoning field name', () => {
        expect(
            parseSseLine('data: {"choices":[{"delta":{"reasoning":"think"}}]}')?.reasoning
        ).toBe('think');
        expect(
            parseSseLine('data: {"choices":[{"delta":{"reasoning_content":"think2"}}]}')?.reasoning
        ).toBe('think2');
    });

    it('recognizes [DONE] and ignores non-data or empty lines', () => {
        expect(parseSseLine('data: [DONE]')).toEqual({ done: true });
        expect(parseSseLine('event: message')).toBeNull();
        expect(parseSseLine('')).toBeNull();
        expect(parseSseLine('data: ')).toBeNull();
    });

    it('parses a usage-only chunk', () => {
        const chunk = parseSseLine('data: {"usage":{"total_tokens":42},"choices":[]}');
        expect(chunk?.usage).toEqual({ total_tokens: 42 });
    });

    it('returns an error for provider error objects and terminal finish reasons', () => {
        const provider = parseSseLine('data: {"error":{"message":"quota exceeded"}}');
        expect(provider?.error?.message).toBe('quota exceeded');

        const terminal = parseSseLine(
            'data: {"choices":[{"delta":{},"finish_reason":"error"}]}'
        );
        expect(terminal?.error?.message).toBe('AI stream failed.');
    });

    it('returns null for malformed JSON', () => {
        expect(parseSseLine('data: {not json')).toBeNull();
    });
});

describe('appendChunk', () => {
    it('accumulates content and reasoning and reports the chunk', () => {
        const accumulator: ChatAccumulator = { content: '', reasoning: '', usage: null };
        const onChunk = jest.fn();

        appendChunk(accumulator, { content: 'He', reasoning: 'r0' }, onChunk);
        appendChunk(accumulator, { content: 'llo', reasoning: undefined }, onChunk);
        appendChunk(accumulator, { content: undefined, reasoning: 'r1' }, onChunk);

        expect(accumulator.content).toBe('Hello');
        expect(accumulator.reasoning).toBe('r0r1');
        expect(onChunk).toHaveBeenNthCalledWith(1, 'He', 'r0');
        // A chunk with no reasoning passes reasoning through as-is.
        expect(onChunk).toHaveBeenNthCalledWith(2, 'llo', undefined);
        expect(onChunk).toHaveBeenNthCalledWith(3, '', 'r1');
    });
});

describe('readStreamResponse', () => {
    it('assembles content split across arbitrary chunk boundaries', async () => {
        const { body, reader, cancel } = streamBody([
            'data: {"choices":[{"delta":{"content":"Hel',
            'lo"}}]}\ndata: {"choices":[{"delta":{"content":" wor',
            'ld"}}]}\ndata: [DONE]\n',
        ]);
        const onChunk = jest.fn();
        const onComplete = jest.fn();

        const usage = await readStreamResponse(body, onChunk, onComplete);

        expect(onComplete).toHaveBeenCalledWith('Hello world', '');
        expect(usage).toBeNull();
        expect(onChunk.mock.calls.length).toBeGreaterThan(0);
        expect(reader.read).toHaveBeenCalled();
        // Stream lease is released deterministically even on normal completion.
        expect(cancel).toHaveBeenCalled();
    });

    it('handles [DONE] left in the buffer at EOF without a trailing newline', async () => {
        const { body, cancel } = streamBody([
            'data: {"choices":[{"delta":{"content":"done-ish"}}]}\n',
            'data: [DONE]',
        ]);
        const onComplete = jest.fn();

        await readStreamResponse(body, jest.fn(), onComplete);

        expect(onComplete).toHaveBeenCalledWith('done-ish', '');
        expect(cancel).toHaveBeenCalled();
    });

    it('reports usage through the usage callback and returns it', async () => {
        const { body } = streamBody([
            'data: {"choices":[{"delta":{"content":"hi"}}]}\n',
            'data: {"usage":{"prompt_tokens":7,"total_tokens":9},"choices":[]}\n',
            'data: [DONE]\n',
        ]);
        const onUsage = jest.fn();

        const usage = await readStreamResponse(body, jest.fn(), jest.fn(), onUsage);

        expect(usage).toEqual({ prompt_tokens: 7, total_tokens: 9 });
        expect(onUsage).toHaveBeenCalledWith({ prompt_tokens: 7, total_tokens: 9 });
    });

    it('throws the provider error mid-stream', async () => {
        const { body } = streamBody([
            'data: {"choices":[{"delta":{"content":"a"}}]}\n',
            'data: {"error":{"message":"context length exceeded"}}\n',
        ]);

        await expect(
            readStreamResponse(body, jest.fn(), jest.fn())
        ).rejects.toThrow('context length exceeded');
    });

    it('rejects a stream that never produces a final answer', async () => {
        const { body } = streamBody(['\n', 'event: ping\n']);

        await expect(
            readStreamResponse(body, jest.fn(), jest.fn())
        ).rejects.toThrow('AI response did not include a final answer');
    });

    it('rejects reasoning-only output so callers surface a retry instead of an empty reply', async () => {
        const { body } = streamBody([
            'data: {"choices":[{"delta":{"reasoning":"ruminating"}}]}\n',
            'data: [DONE]\n',
        ]);

        await expect(
            readStreamResponse(body, jest.fn(), jest.fn())
        ).rejects.toThrow('AI response ended after reasoning without a final answer');
    });
});

describe('readNonStreamingResponse', () => {
    it('parses a plain JSON completion', async () => {
        const response = responseWithText(
            JSON.stringify({ choices: [{ message: { content: 'Full reply' } }], usage: { total_tokens: 5 } })
        );
        const result = await readNonStreamingResponse(response);

        expect(result.content).toBe('Full reply');
        expect(result.usage).toEqual({ total_tokens: 5 });
    });

    it('falls back to parsing an SSE-shaped transcript', async () => {
        const response = responseWithText(
            'data: {"choices":[{"delta":{"content":"A"}}]}\ndata: {"choices":[{"delta":{"content":"B"}}]}\ndata: [DONE]\n'
        );
        const result = await readNonStreamingResponse(response);

        expect(result.content).toBe('AB');
    });

    it('rejects empty or non-JSON bodies with a preview', async () => {
        await expect(readNonStreamingResponse(responseWithText('oops'))).rejects.toThrow(
            'AI response was not valid JSON. Preview: oops'
        );
        await expect(readNonStreamingResponse(responseWithText('{}'))).rejects.toThrow(
            'AI response did not include a final answer'
        );
    });
});

describe('buildResponseError', () => {
    it('includes provider message, status and context', async () => {
        const response = responseWithText(
            JSON.stringify({ error: { message: 'Rate limited' } }),
            429
        );
        const error = await buildResponseError(response, 'Chat request failed', true);

        expect(error.message).toContain('Chat request failed (status 429, streaming=true).');
        expect(error.message).toContain('Provider: Rate limited');
    });

    it('handles string and type-only provider errors', async () => {
        const stringError = await buildResponseError(
            responseWithText(JSON.stringify({ error: 'overloaded' }), 503),
            'ctx',
            false
        );
        expect(stringError.message).toContain('Provider: overloaded');

        const typeError = await buildResponseError(
            responseWithText(JSON.stringify({ error: { type: 'upstream_error' } }), 500),
            'ctx',
            false
        );
        expect(typeError.message).toContain('Provider: upstream_error');
    });

    it('attaches a raw preview when no provider error shape is present', async () => {
        const error = await buildResponseError(responseWithText('plain text body', 200), 'ctx', false);

        expect(error.message).toContain('Preview: plain text body');
        expect(error.message).not.toContain('Provider:');
    });
});
