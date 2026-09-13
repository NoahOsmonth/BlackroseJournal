import { completeChat, Message, streamChat } from '../../../services/ai';
import { HISTORY_TOOLS_POLICY } from '../../../services/ai/tools';
import { isMarkedToolsUnsupported, clearToolsUnsupportedCache } from '../../../services/ai/tools/toolCapability';

const testModel = 'custom-model-without-tools';

jest.mock('../../../services/ai/directConfig', () => ({
    getDirectConfig: () => ({
        apiKey: 'sk-direct-test-key',
        apiBaseUrl: 'https://nano-gpt.com/api/v1',
        model: 'custom-model-without-tools',
        flashModel: 'custom-model-without-tools',
    }),
    getResolvedDirectConfig: () => Promise.resolve({
        apiKey: 'sk-direct-test-key',
        apiBaseUrl: 'https://nano-gpt.com/api/v1',
        model: 'custom-model-without-tools',
        flashModel: 'custom-model-without-tools',
        source: 'env',
        contextWindow: 32_768,
        contextWindowSource: 'fallback',
    }),
}));

jest.mock('../../../services/ai/customModels', () => {
    const actual = jest.requireActual('../../../services/ai/customModels');
    return {
        ...actual,
        getKnownContextWindow: () => 32_768,
        loadCustomAiProviderSettings: jest.fn(async () => ({
            ...actual.getDefaultCustomAiProviderSettings(),
            enabled: true,
            selectedModelId: 'custom-model-without-tools',
        })),
    };
});

const mockRunAgentTurnWithTools = jest.fn();
jest.mock('../../../services/ai/agentLoop', () => {
    const actual = jest.requireActual('../../../services/ai/agentLoop');
    return {
        ...actual,
        runAgentTurnWithTools: (...args: unknown[]) => mockRunAgentTurnWithTools(...args),
    };
});

describe('streamChat and completeChat model dispatch and tools unsupported fallback', () => {
    const originalFetch = global.fetch;
    const originalXhr = global.XMLHttpRequest;
    let fetchMock: jest.Mock;

    const messages: Message[] = [{
        id: '1',
        role: 'user',
        content: 'what did I write yesterday about work?',
        timestamp: Date.now(),
    }];

    beforeEach(() => {
        clearToolsUnsupportedCache();
        fetchMock = jest.fn();
        global.fetch = fetchMock as unknown as typeof fetch;
        mockRunAgentTurnWithTools.mockReset();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        (global as unknown as { XMLHttpRequest: typeof originalXhr }).XMLHttpRequest = originalXhr;
        clearToolsUnsupportedCache();
        jest.restoreAllMocks();
    });

    it('catches ToolsUnsupportedError, marks model unsupported, strips tool policy, and streams fallback', async () => {
        const { ToolsUnsupportedError } = jest.requireActual('../../../services/ai/agentLoop');
        mockRunAgentTurnWithTools.mockRejectedValueOnce(
            new ToolsUnsupportedError('Provider rejected tools (400): tools not supported')
        );

        fetchMock.mockResolvedValueOnce(
            new Response([
                'data: {"choices":[{"delta":{"content":"You wrote about feeling overwhelmed."}}]}',
                'data: [DONE]',
                '',
            ].join('\n'), {
                status: 200,
                headers: { 'Content-Type': 'text/event-stream' },
            })
        );

        const onChunk = jest.fn();
        const onComplete = jest.fn();
        const onError = jest.fn();

        const initialPrompt = `You are a companion.\n\n${HISTORY_TOOLS_POLICY}`;

        await streamChat(
            messages,
            onChunk,
            onComplete,
            onError,
            { systemPrompt: initialPrompt, model: testModel, enableHistoryTools: true }
        );

        expect(onError).not.toHaveBeenCalled();
        expect(isMarkedToolsUnsupported(testModel)).toBe(true);

        // Verify the stream fallback received the stripped system prompt without tool policy
        const streamCall = fetchMock.mock.calls[0];
        expect(streamCall).toBeDefined();
        const body = JSON.parse(String(streamCall[1].body)) as { model: string; messages: { role: string; content: string }[] };
        expect(body.model).toBe(testModel);
        const sysMsg = body.messages.find((m) => m.role === 'system');
        expect(sysMsg?.content).not.toContain(HISTORY_TOOLS_POLICY);
        expect(onComplete).toHaveBeenCalledWith('You wrote about feeling overwhelmed.', '');
    });

    it('completeChat dispatches options.model instead of hardcoded DEFAULT_DIRECT_MODEL', async () => {
        fetchMock.mockResolvedValueOnce(
            new Response(JSON.stringify({
                choices: [{ message: { content: 'test reply', reasoning: '' } }],
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const targetModel = 'my-custom-model-id';
        await completeChat(messages, 'system prompt', { model: targetModel });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        const body = JSON.parse(String(init.body)) as { model: string };
        expect(body.model).toBe(targetModel);
    });
});
