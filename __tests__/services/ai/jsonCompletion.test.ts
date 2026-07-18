/**
 * Shared JSON completion helper — structured → freeform fallback.
 *
 * What would make these fail?
 * - Not retrying without response_format after a 400 json_object rejection
 * - Accepting freeform garbage as success at the transport layer (callers
 *   own schema validation; helper only returns content)
 * - Skipping freeform when model was not marked as rejecting structured mode
 */

/* eslint-disable import/first */

jest.mock('../../../services/ai/directTransport', () => ({
    fetchDirectChatCompletion: jest.fn(),
}));

import { fetchDirectChatCompletion } from '../../../services/ai/directTransport';
import {
    extractFirstJsonObject,
    fetchDirectJsonCompletion,
    parseJsonFromModelText,
    resetJsonCompletionStateForTests,
} from '../../../services/ai/jsonCompletion';

const mockFetch = jest.mocked(fetchDirectChatCompletion);

function okJsonContent(content: string): Response {
    return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content } }] }),
        text: async () => '',
    } as Response;
}

function failJsonObject400(): Response {
    const body = JSON.stringify({
        error: {
            message: "Model 'tencent/hy3' does not support 'json_object' response format",
            code: 400,
            metadata: { raw: '{"reason":"INVALID_REQUEST_BODY"}' },
        },
    });
    return {
        ok: false,
        status: 400,
        json: async () => JSON.parse(body),
        text: async () => body,
    } as Response;
}

describe('jsonCompletion', () => {
    beforeEach(() => {
        mockFetch.mockReset();
        resetJsonCompletionStateForTests();
    });

    it('extractFirstJsonObject pulls object from prose / fences', () => {
        expect(extractFirstJsonObject('Sure!\n```json\n{"a":1}\n```')).toBe('{"a":1}');
        expect(parseJsonFromModelText<{ a: number }>('Here: {"a":2} ok')?.a).toBe(2);
        expect(parseJsonFromModelText('not json')).toBeNull();
    });

    it('uses structured mode when the provider accepts response_format', async () => {
        mockFetch.mockResolvedValueOnce(okJsonContent('{"preferredName":"Sigurd"}'));
        const result = await fetchDirectJsonCompletion(
            {
                messages: [{ role: 'user', content: 'I am Sigurd' }],
                max_tokens: 128,
            },
            { modelPurpose: 'flash' },
        );
        expect(result.usedResponseFormat).toBe(true);
        expect(result.content).toContain('Sigurd');
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch.mock.calls[0][0]).toEqual(
            expect.objectContaining({ response_format: { type: 'json_object' } }),
        );
    });

    /**
     * SABOTAGE 1 (direction: fallback must fire on json_object 400):
     * Force structured request to 400; freeform must still return content.
     * Break by: removing freeform retry in fetchDirectJsonCompletion.
     */
    it('sabotage: response_format 400 retries freeform and returns content', async () => {
        mockFetch
            .mockResolvedValueOnce(failJsonObject400())
            .mockResolvedValueOnce(
                okJsonContent('Here is the extract:\n{"preferredName":"Sigurd","confidence":0.9}'),
            );

        const result = await fetchDirectJsonCompletion(
            {
                messages: [
                    { role: 'system', content: 'extract identity as JSON' },
                    { role: 'user', content: 'I am Sigurd' },
                ],
            },
            { modelPurpose: 'flash' },
        );

        expect(result.usedResponseFormat).toBe(false);
        expect(result.content).toContain('Sigurd');
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(mockFetch.mock.calls[0][0].response_format).toEqual({ type: 'json_object' });
        expect(mockFetch.mock.calls[1][0].response_format).toBeUndefined();
        // Freeform parse still yields valid JSON for callers.
        expect(parseJsonFromModelText<{ preferredName: string }>(result.content)?.preferredName)
            .toBe('Sigurd');
    });

    it('remembers rejecting models and skips structured on the next call', async () => {
        mockFetch
            .mockResolvedValueOnce(failJsonObject400())
            .mockResolvedValueOnce(okJsonContent('{"ok":true}'))
            .mockResolvedValueOnce(okJsonContent('{"ok":true}'));

        await fetchDirectJsonCompletion(
            { messages: [{ role: 'user', content: 'a' }] },
            { modelPurpose: 'flash' },
        );
        await fetchDirectJsonCompletion(
            { messages: [{ role: 'user', content: 'b' }] },
            { modelPurpose: 'flash' },
        );

        // 1 structured + 1 freeform, then freeform-only
        expect(mockFetch).toHaveBeenCalledTimes(3);
        expect(mockFetch.mock.calls[2][0].response_format).toBeUndefined();
    });

    /**
     * SABOTAGE 2 (direction: freeform garbage does not invent success):
     * Structured 400 + freeform returns non-JSON. Helper still returns the
     * raw content (transport OK); parseJsonFromModelText is null — callers
     * fail closed. Break by: having helper fake-parse and invent {}.
     */
    it('sabotage: freeform garbage returns content but parse fails closed', async () => {
        mockFetch
            .mockResolvedValueOnce(failJsonObject400())
            .mockResolvedValueOnce(okJsonContent('I cannot extract anything useful today.'));

        const result = await fetchDirectJsonCompletion(
            { messages: [{ role: 'user', content: 'I am Sigurd' }] },
            { modelPurpose: 'flash' },
        );

        expect(result.usedResponseFormat).toBe(false);
        expect(result.content).toContain('cannot extract');
        expect(parseJsonFromModelText(result.content)).toBeNull();
    });

    it('throws without freeform retry on non-format 401', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            text: async () => 'unauthorized',
            json: async () => ({}),
        } as Response);

        await expect(
            fetchDirectJsonCompletion(
                { messages: [{ role: 'user', content: 'x' }] },
                { modelPurpose: 'flash' },
            ),
        ).rejects.toThrow(/401/);
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });
});
