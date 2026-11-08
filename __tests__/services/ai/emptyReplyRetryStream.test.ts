import { streamChat } from '../../../services/ai';
import type { Message } from '../../../services/ai';

// jest hoists mock factories above imports, so shared state lives on globalThis.
const state = globalThis as unknown as {
    __retryTest: { seen: Array<{ model: string; tools: unknown }>; replies: string[] };
};
state.__retryTest = { seen: [], replies: [] };

const getSeen = () => state.__retryTest.seen;
const setReplies = (values: string[]) => { state.__retryTest.replies = values; };

jest.mock('../../../services/ai/directConfig', () => ({
    getDirectConfig: () => ({ apiKey: 'sk-test', apiBaseUrl: 'https://api.example.com/v1', model: 'primary-model' }),
    getResolvedDirectConfig: () => Promise.resolve({
        apiKey: 'sk-test',
        apiBaseUrl: 'https://api.example.com/v1',
        model: 'primary-model',
        source: 'custom',
        fallbackModelIds: ['backup-model'],
    }),
}));

jest.mock('../../../services/ai/customModels', () => {
    const actual = jest.requireActual('../../../services/ai/customModels');
    return {
        ...actual,
        loadCustomAiProviderSettings: jest.fn(async () => ({
            ...actual.getDefaultCustomAiProviderSettings(), enabled: true,
        })),
    };
});

jest.mock('../../../services/ai/aiTransport', () => ({
    runAgentTurn: jest.fn(async () => ({ content: '', reasoning: '', activity: [] })),
}));

jest.mock('../../../services/ai/streamingTransports', () => ({
    streamChatWithXhr: jest.fn(async (payload: Record<string, unknown>, _c: unknown, onComplete: (c: string, r: string) => void) => {
        globalThis.__retryTest.seen.push({
            model: String(payload.model ?? ''),
            tools: payload.tools ?? null,
        });
        onComplete(globalThis.__retryTest.replies.shift() ?? '', '');
        return { ok: true, usage: null };
    }),
}));

const messages: Message[] = [
    { id: '1', role: 'user', content: 'hello', timestamp: Date.now() },
];

async function run(toolsOn = true) {
    const onComplete = jest.fn();
    const onError = jest.fn();
    await streamChat(messages, jest.fn(), onComplete, onError, { enableHistoryTools: toolsOn });
    return { onComplete, onError };
}

describe('streamChat empty-reply retry (Kaneo #50)', () => {
    beforeEach(() => {
        state.__retryTest.seen.length = 0;
        state.__retryTest.replies = [];
    });

    it('does not retry when the first reply has words', async () => {
        setReplies(['A real answer.']);
        const { onComplete } = await run();
        expect(getSeen()).toHaveLength(1);
        expect(onComplete).toHaveBeenCalledWith('A real answer.', '');
    });

    it('retries with tools off when the first reply is empty', async () => {
        setReplies(['', 'Second time lucky.']);
        const { onComplete } = await run();
        expect(getSeen()).toHaveLength(2);
        expect(getSeen()[1].tools).toBeNull();
        expect(onComplete).toHaveBeenCalledWith('Second time lucky.', '');
    });

    it('uses the backup AI option when tools-off is also empty', async () => {
        setReplies(['', '', 'From the backup.']);
        const { onComplete } = await run();
        expect(getSeen()).toHaveLength(3);
        expect(getSeen()[2].model).toBe('backup-model');
        expect(onComplete).toHaveBeenCalledWith('From the backup.', '');
    });

    it('gives the plain sentence only after every attempt is empty', async () => {
        setReplies(['', '', '']);
        const { onComplete } = await run();
        expect(getSeen()).toHaveLength(3);
        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(String(onComplete.mock.calls[0][0]).length).toBeGreaterThan(10);
    });

    it('does not retry with tools off when tools were already off', async () => {
        setReplies(['', 'From the backup.']);
        const { onComplete } = await run(false);
        expect(getSeen()).toHaveLength(2);
        expect(getSeen()[1].model).toBe('backup-model');
        expect(onComplete).toHaveBeenCalledWith('From the backup.', '');
    });

    it('never makes more than three attempts', async () => {
        setReplies(['', '', '', '', 'extra']);
        await run();
        expect(getSeen()).toHaveLength(3);
    });

    it('streams the retry answer to the screen, not just to the callback', async () => {
        setReplies(['', 'Comes through on the second try.']);
        const onChunk = jest.fn();
        const onComplete = jest.fn();
        await streamChat(messages, onChunk, onComplete, jest.fn(), { enableHistoryTools: true });
        expect(onComplete).toHaveBeenCalledWith('Comes through on the second try.', '');
    });

    it('reports a transport failure once instead of retrying over it', async () => {
        const { streamChatWithXhr } = jest.requireMock('../../../services/ai/streamingTransports') as {
            streamChatWithXhr: jest.Mock;
        };
        streamChatWithXhr.mockImplementationOnce(async () => { throw new Error('network down'); });
        const onError = jest.fn();
        const onComplete = jest.fn();
        await streamChat(messages, jest.fn(), onComplete, onError, { enableHistoryTools: true });
        expect(onError).toHaveBeenCalled();
        expect(onComplete).not.toHaveBeenCalled();
    });
});
