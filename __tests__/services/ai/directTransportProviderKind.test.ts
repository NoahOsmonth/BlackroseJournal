/**
 * Provider *kind* → wire shape.
 *
 * Every provider kind answers `POST {baseUrl}/chat/completions` with an
 * OpenAI-shaped body, so a request that works for one can still be a hard 400 on
 * another. These tests pin the fields that must be withheld per kind, and the
 * ones that must survive.
 *
 * What would make these fail?
 * - Sending `temperature` + `top_p` together to Anthropic (documented 400).
 * - Sending `response_format: json_object` to Anthropic (only `json_schema`).
 * - Forcing `tool_choice: required` on a model that rejects it.
 * - Withholding any of those from a plain OpenAI-compatible endpoint, which is
 *   the default for every user who never opened the picker.
 */
import { getResolvedDirectConfig } from '../../../services/ai/directConfig';
import { fetchDirectChatCompletion } from '../../../services/ai/directTransport';
import type { ProviderKind } from '../../../services/ai/customModels';

jest.mock('../../../services/ai/directConfig', () => ({
    getDirectConfig: jest.fn(),
    getResolvedDirectConfig: jest.fn(),
}));

jest.mock('../../../services/ai/customModels', () => {
    const actual = jest.requireActual('../../../services/ai/customModels') as typeof import('../../../services/ai/customModels');
    return {
        ...actual,
        loadCustomAiProviderSettings: jest.fn(() => Promise.resolve(
            (jest.requireActual('../../mocks/providerSettings') as typeof import('../../mocks/providerSettings'))
                .makeProviderSettings(),
        )),
    };
});

const BASE_PAYLOAD = {
    model: 'some/model',
    messages: [{ role: 'user', content: 'Hello' }],
    stream: false,
};

const GOOGLE_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai';
const ANTHROPIC_BASE = 'https://api.anthropic.com/v1';

describe('directTransport — provider kind shapes the request', () => {
    const originalFetch = global.fetch;
    let fetchMock: jest.Mock;

    beforeEach(() => {
        fetchMock = jest.fn();
        global.fetch = fetchMock as unknown as typeof fetch;
        fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    });

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    function useConfig(kind: ProviderKind, apiBaseUrl: string) {
        jest.mocked(getResolvedDirectConfig).mockResolvedValue({
            apiKey: 'sk-kind',
            apiBaseUrl,
            model: 'some/model',
            flashModel: 'some/model',
            source: 'custom',
            kind,
        });
    }

    /** The body the transport actually put on the wire for attempt 0. */
    function sentBody(call = 0): Record<string, unknown> {
        const [, init] = fetchMock.mock.calls[call] as [string, RequestInit];
        return JSON.parse(String(init.body)) as Record<string, unknown>;
    }

    it('keeps temperature and top_p for an OpenAI-compatible endpoint', async () => {
        useConfig('openai', 'https://api.example.com/v1');

        await fetchDirectChatCompletion({ ...BASE_PAYLOAD, temperature: 0.7, top_p: 0.9 });

        expect(sentBody()).toMatchObject({ temperature: 0.7, top_p: 0.9 });
    });

    /**
     * SABOTAGE 4 (direction: Anthropic must not receive sampling fields).
     *
     * `buildChatPayload` always sets temperature 1 and top_p 0.95, and Anthropic
     * returns 400 for a request that sets both — so this is the shape every real
     * turn would send, not a corner case.
     * Break by: dropping the `omitSamplingFields` branch in
     * `buildPreparedDirectChatRequest`.
     */
    it('sabotage: omits temperature and top_p for Anthropic', async () => {
        useConfig('anthropic', ANTHROPIC_BASE);

        await fetchDirectChatCompletion({ ...BASE_PAYLOAD, temperature: 1, top_p: 0.95 });

        const body = sentBody();
        expect(body).not.toHaveProperty('temperature');
        expect(body).not.toHaveProperty('top_p');
    });

    it('drops response_format for Anthropic but keeps it for Google', async () => {
        useConfig('anthropic', ANTHROPIC_BASE);
        await fetchDirectChatCompletion({
            ...BASE_PAYLOAD,
            response_format: { type: 'json_object' },
        });
        expect(sentBody()).not.toHaveProperty('response_format');

        fetchMock.mockClear();
        useConfig('google', GOOGLE_BASE);
        await fetchDirectChatCompletion({
            ...BASE_PAYLOAD,
            response_format: { type: 'json_object' },
        });
        expect(sentBody().response_format).toEqual({ type: 'json_object' });
    });

    /**
     * SABOTAGE 3 (direction: a forced tool choice must reach the wire): the
     * transport must pass `tool_choice` through untouched on every kind. It
     * cannot know which Claude models accept `required`, and the agent loop
     * already retries `auto` on the 400/422 that a rejecting model returns.
     * Break by: reinstating a blanket `forceToolChoiceUnsupported` downgrade,
     * which silently weakens forced tool use and turns `none` into `auto`.
     */
    it('sabotage: passes a forced tool_choice through for Anthropic', async () => {
        useConfig('anthropic', ANTHROPIC_BASE);

        await fetchDirectChatCompletion({
            ...BASE_PAYLOAD,
            tools: [{ type: 'function', function: { name: 'get_clock' } }],
            tool_choice: 'required',
        });

        expect(sentBody().tool_choice).toBe('required');
    });

    it('keeps a forced tool_choice for a Google endpoint', async () => {
        useConfig('google', GOOGLE_BASE);

        await fetchDirectChatCompletion({
            ...BASE_PAYLOAD,
            tools: [{ type: 'function', function: { name: 'get_clock' } }],
            tool_choice: 'required',
        });

        expect(sentBody().tool_choice).toBe('required');
    });

    it('keeps tool_choice none for Anthropic', async () => {
        // `none` is an instruction NOT to call a tool. A blanket downgrade would
        // hand the endpoint permission to run a tool the caller disabled.
        useConfig('anthropic', ANTHROPIC_BASE);

        await fetchDirectChatCompletion({
            ...BASE_PAYLOAD,
            tools: [{ type: 'function', function: { name: 'get_clock' } }],
            tool_choice: 'none',
        });

        expect(sentBody().tool_choice).toBe('none');
    });
});
